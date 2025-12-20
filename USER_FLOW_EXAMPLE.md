# First Message Flow - What User Sees

## Step-by-Step Walkthrough

When you deploy, configure the webhook in Meta, and a user sends their first message:

### **USER SENDS: "Hi"** (or any message)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Meta WhatsApp Cloud API                      │
│  Receives: User's phone sends "Hi"                              │
│  Forwards to: Your Cloud Function webhook                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│              Cloud Function: whatsappWebhook                     │
│  Webhook Handler receives POST request                          │
│  Extracts: phone = "254712345678", text = "Hi"                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│              Session Service: createOrGetSession()              │
│  Checks: Does session exist in Firestore?                       │
│  Result: NEW user → Create fresh session                        │
│  Session created: {                                             │
│    phone: "254712345678",                                       │
│    language: "en" (default),                                    │
│    currentState: "LANGUAGE_SELECTION",                          │
│    context: {},                                                 │
│    lastActive: 1730000000,                                      │
│    createdAt: 1730000000                                        │
│  }                                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│              Check session.currentState                         │
│  State: LANGUAGE_SELECTION                                      │
│  → Route to: handleLanguageSelection()                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│        Language Handler: handleLanguageSelection()              │
│  Input: text = "Hi"                                             │
│  Validation: Is input "1" or "2"?                               │
│  Result: "Hi" is INVALID (not 1 or 2)                          │
│  → Return: WELCOME menu again                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│        getMenu('WELCOME', language='en')                        │
│  Returns the welcome text:                                      │
│                                                                 │
│  "Welcome to *Cogvana Biz* Property & Shop Manager! 🏠          │
│                                                                 │
│   Please select your language:                                  │
│   1. English                                                    │
│   2. Kiswahili"                                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│   WhatsApp Service: sendWhatsAppMessage()                       │
│  Makes API call to Meta WhatsApp Cloud API                      │
│  POST https://graph.facebook.com/v23.0/{PHONE_ID}/messages      │
│  Body: {                                                        │
│    messaging_product: "whatsapp",                               │
│    to: "254712345678",                                          │
│    type: "text",                                                │
│    text: {                                                      │
│      body: "Welcome to *Cogvana Biz*..."                        │
│    }                                                            │
│  }                                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Meta WhatsApp Cloud API                      │
│  Forwards message to user's phone                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
```

### **USER RECEIVES:**

```
┌─────────────────────────────────────────────────────────────────┐
│              WhatsApp on User's Phone                           │
│                                                                 │
│  Welcome to Cogvana Biz Property & Shop Manager! 🏠              │
│                                                                 │
│  Please select your language:                                   │
│  1. English                                                     │
│  2. Kiswahili                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Second Message - User Selects Language

### **USER SENDS: "1"** (English)

```
Meta → Cloud Function → Session Service (retrieves existing session)
→ Session state is LANGUAGE_SELECTION
→ handleLanguageSelection(phone, "1", session)
→ Validates: "1" is valid ✓
→ Updates: language = "en", state = "MAIN_MENU"
→ Returns: getMenu('MAIN_MENU', 'en')
```

### **USER RECEIVES:**

```
┌─────────────────────────────────────────────────────────────────┐
│              WhatsApp on User's Phone                           │
│                                                                 │
│  *Main Menu*                                                    │
│                                                                 │
│  1. Pay Rent                                                    │
│  2. Get Rent Invoice                                            │
│  3. Add Shop                                                    │
│  4. My Shop                                                     │
│  5. Pay Bill                                                    │
│  6. Manage My Plot                                              │
│  7. Exit                                                        │
│  8. Help                                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Third Message - User Selects Add Shop

### **USER SENDS: "3"** (Add Shop)

```
Meta → Cloud Function → Session Service (retrieves session)
→ Session state is MAIN_MENU
→ handleMainMenu(phone, "3", session)
→ Validates: "3" is valid ✓
→ Case 3: Add Shop
→ Updates: state = "ADD_SHOP_NAME"
→ Returns: "Let's set up your shop! 🏪\n\nWhat is your full name?"
```

### **USER RECEIVES:**

```
┌─────────────────────────────────────────────────────────────────┐
│              WhatsApp on User's Phone                           │
│                                                                 │
│  Let's set up your shop! 🏪                                      │
│                                                                 │
│  What is your full name?                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fourth Message - User Enters Name

### **USER SENDS: "John Doe"**

```
Meta → Cloud Function → Session Service (retrieves session)
→ Session state is ADD_SHOP_NAME
→ handleAddShopName(phone, "John Doe", session)
→ Validates: 2-50 chars, alphanumeric ✓
→ Updates: context.ownerName = "John Doe", state = "ADD_SHOP_BUSINESS_NAME"
→ Returns: "What is your shop name?"
```

### **USER RECEIVES:**

```
┌─────────────────────────────────────────────────────────────────┐
│              WhatsApp on User's Phone                           │
│                                                                 │
│  What is your shop name?                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fifth Message - Shop Name

### **USER SENDS: "John's Electronics"**

```
→ handleAddShopBusinessName(phone, "John's Electronics", session)
→ Updates: context.shopName = "John's Electronics"
→ state = "ADD_SHOP_ID"
→ Returns: "Please enter your National ID:"
```

### **USER RECEIVES:**

```
Please enter your National ID:
```

---

## Sixth Message - National ID

### **USER SENDS: "12345678"**

```
→ handleAddShopNationalId(phone, "12345678", session)
→ Validates: 8 digits, no all zeros, not sequential ✓
→ Updates: context.nationalId = "12345678"
→ state = "ADD_SHOP_PHONE"
→ Returns: "Enter your phone number (07XXXXXXXX):"
```

### **USER RECEIVES:**

```
Enter your phone number (07XXXXXXXX):
```

---

## Seventh Message - Phone

### **USER SENDS: "0712345678"**

```
→ handleAddShopPhone(phone, "0712345678", session)
→ Validates: Format valid ✓
→ Auto-formats to: "+254712345678"
→ Updates: context.shopPhone = "0712345678"
→ state = "ADD_SHOP_TYPE"
→ Returns: Business type menu
```

### **USER RECEIVES:**

```
Select Business Type:

1. Retail Shop
2. Restaurant/Cafe
3. Service Provider
4. Salon/Spa/Kinyozi
5. Electronics
6. Clothing
7. Groceries
8. Other
```

---

## Eighth Message - Business Type

### **USER SENDS: "5"** (Electronics)

```
→ handleAddShopBusinessType(phone, "5", session)
→ Updates: context.businessType = "5"
→ state = "ADD_SHOP_PROCESSING"
→ Calls: completeShopCreation()
→ Saves shop to Firestore /shops
→ Generates credentials (email, password)
→ Updates: state = "MAIN_MENU"
→ Returns: Success message with credentials
```

### **USER RECEIVES:**

```
Success! Your shop has been created! 🎉

Here are your login credentials:
📧 Email: johndoe12345678@shopmanager.co.ke
🔐 Password: [Auto-generated secure password]

Please save these credentials safely.
```

---

## The Session in Firestore

After all this, the user's session in Firestore looks like:

```firestore
Collection: whatsapp_sessions
Document: 254712345678
{
  phone: "254712345678",
  language: "en",
  currentState: "MAIN_MENU",
  context: {
    ownerName: "John Doe",
    shopName: "John's Electronics",
    nationalId: "12345678",
    shopPhone: "0712345678",
    businessType: "5"
  },
  lastActive: 1730000005,
  createdAt: 1730000000
}
```

A new shop document was also created:

```firestore
Collection: shops
Document: auto-generated-id
{
  id: "auto-generated-id",
  ownerName: "John Doe",
  shopName: "John's Electronics",
  nationalId: "12345678",
  phone: "0712345678",
  email: "johndoe12345678@shopmanager.co.ke",
  businessType: "5",
  createdAt: 1730000005,
  createdVia: "whatsapp",
  status: "active"
}
```

---

## Next Message - Back to Menu

### **USER SENDS: "3"** (From main menu)

```
→ Session is now at MAIN_MENU
→ handleMainMenu(phone, "3", session)
→ User already has a shop (can check in later phases)
→ For now, shows: "What is your full name?" (Add another shop)
```

---

## Key Points

✅ **Session persistence** - User's state is saved, so each message picks up where it left off
✅ **Context preservation** - Multi-step forms work across multiple messages
✅ **Validation** - Each step validates before moving to next
✅ **Language locked** - Once user picks language, all responses are in that language
✅ **Error recovery** - Invalid input shows the same prompt again
✅ **Database integration** - Data is saved to Firestore for later retrieval

---

## What Actually Displays to User

### First interaction (formatted in WhatsApp):

```
Welcome to Cogvana Biz Property & Shop Manager! 🏠

Please select your language:
1. English
2. Kiswahili
```

(Bold text appears as *bold* in WhatsApp - the asterisks are WhatsApp formatting)

All text is formatted and clean, no raw JSON or technical details shown to the user.
