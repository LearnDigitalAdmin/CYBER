/**
 * MyChama Menus & Messages
 *
 * Every user-facing MyChama string lives here in English and Kiswahili so the
 * handlers stay free of inline copy. Placeholders use {braces} and are filled
 * by mcMsg(). Missing keys fail loudly rather than printing an empty bubble.
 */

export type Lang = 'en' | 'sw';

export const MC_MENUS: Record<string, Record<Lang, string>> = {
  MYCHAMA_MENU: {
    en:
      '*My Chama* — {chamaName}\n' +
      'Signed in as {memberName}\n\n' +
      '1. Pay Contribution 💰\n' +
      '2. Apply for a Loan 📝\n' +
      '3. Repay a Loan 💳\n' +
      '4. Loan Balance 📊\n' +
      '5. Merry-Go-Round 🔄\n' +
      '6. Get Statement 📄\n' +
      '7. Switch Chama 🔁\n' +
      '8. Back to Main Menu',
    sw:
      '*Chama Changu* — {chamaName}\n' +
      'Umeingia kama {memberName}\n\n' +
      '1. Lipa Mchango 💰\n' +
      '2. Omba Mkopo 📝\n' +
      '3. Lipa Mkopo 💳\n' +
      '4. Salio la Mkopo 📊\n' +
      '5. Mzunguko (Merry-Go-Round) 🔄\n' +
      '6. Pata Taarifa 📄\n' +
      '7. Badilisha Chama 🔁\n' +
      '8. Rudi kwenye Menyu Kuu',
  },

  STATEMENT_TYPE: {
    en:
      '*Get Statement*\n\nWhat would you like a statement of?\n\n' +
      '1. Contributions\n2. Loans\n3. Merry-Go-Round\n4. Everything',
    sw:
      '*Pata Taarifa*\n\nUnataka taarifa ya nini?\n\n' +
      '1. Michango\n2. Mikopo\n3. Mzunguko\n4. Yote',
  },

  STATEMENT_PERIOD: {
    en: '*Choose a period:*\n\n1. This month\n2. Last 3 months\n3. This year\n4. All time',
    sw: '*Chagua kipindi:*\n\n1. Mwezi huu\n2. Miezi 3 iliyopita\n3. Mwaka huu\n4. Muda wote',
  },

  PROVIDER: {
    en: '*Which mobile money network is {phone} on?*\n\n1. M-Pesa (Safaricom)\n2. Airtel Money',
    sw: '*{phone} iko kwenye mtandao gani?*\n\n1. M-Pesa (Safaricom)\n2. Airtel Money',
  },
};

export const MC_MESSAGES: Record<string, Record<Lang, string>> = {
  /* ---------------- authentication ---------------- */
  AUTH_INTRO: {
    en:
      '*My Chama* 🏦\n\nChecking your membership using this WhatsApp number…',
    sw: '*Chama Changu* 🏦\n\nTunakagua uanachama wako kwa namba hii ya WhatsApp…',
  },
  AUTH_NOT_REGISTERED: {
    en:
      'We could not find a chama membership linked to this WhatsApp number.\n\n' +
      'Ask your chama treasurer to add this number to your member profile, then try again.',
    sw:
      'Hatujapata uanachama wa chama unaohusiana na namba hii ya WhatsApp.\n\n' +
      'Muombe mweka hazina wa chama chako aongeze namba hii kwenye wasifu wako, kisha jaribu tena.',
  },
  AUTH_INACTIVE: {
    en:
      'Your membership in *{chamaName}* is currently *{status}*.\n\n' +
      'Please contact your chama officials to reactivate it.',
    sw:
      'Uanachama wako katika *{chamaName}* kwa sasa ni *{status}*.\n\n' +
      'Tafadhali wasiliana na viongozi wa chama chako ili kuurejesha.',
  },
  AUTH_ASK_ID: {
    en:
      'Found you, *{memberName}*. 👋\n\n' +
      'For your security, enter the *last 4 digits* of your National ID to continue:',
    sw:
      'Tumekupata, *{memberName}*. 👋\n\n' +
      'Kwa usalama wako, ingiza *tarakimu 4 za mwisho* za Kitambulisho chako:',
  },
  AUTH_ID_INVALID: {
    en: 'That does not match our records. You have *{remaining}* attempt(s) left.\n\nEnter the last 4 digits of your National ID:',
    sw: 'Hiyo hailingani na kumbukumbu zetu. Umebakiwa na majaribio *{remaining}*.\n\nIngiza tarakimu 4 za mwisho za Kitambulisho chako:',
  },
  AUTH_ID_FORMAT: {
    en: 'Please enter exactly 4 digits — the last 4 of your National ID:',
    sw: 'Tafadhali ingiza tarakimu 4 haswa — 4 za mwisho za Kitambulisho chako:',
  },
  AUTH_LOCKED: {
    en:
      '🔒 Too many incorrect attempts. My Chama is locked on this number for *{minutes}* minutes.\n\n' +
      'If this was not you, contact your chama officials.',
    sw:
      '🔒 Majaribio mengi yasiyo sahihi. Chama Changu kimefungwa kwenye namba hii kwa dakika *{minutes}*.\n\n' +
      'Kama huwa wewe, wasiliana na viongozi wa chama chako.',
  },
  AUTH_REAUTH: {
    en: '🔒 You have been idle for a while. Enter the last 4 digits of your National ID to continue:',
    sw: '🔒 Umekaa kimya kwa muda. Ingiza tarakimu 4 za mwisho za Kitambulisho chako ili kuendelea:',
  },
  SELECT_CHAMA: {
    en: 'You belong to more than one chama. Which one?\n\n{list}',
    sw: 'Wewe ni mwanachama wa chama zaidi ya kimoja. Kipi?\n\n{list}',
  },

  /* ---------------- contributions ---------------- */
  CONTRIB_NONE_DUE: {
    en:
      '✅ *You are fully paid up on contributions.*\n\n' +
      'Total contributed: *{total}*\n{credit}\n' +
      'Nothing is outstanding right now.',
    sw:
      '✅ *Umelipa michango yote.*\n\n' +
      'Jumla uliyochangia: *{total}*\n{credit}\n' +
      'Hakuna deni kwa sasa.',
  },
  CONTRIB_SELECT: {
    en:
      '*Pay Contribution*\n\nOutstanding periods:\n\n{list}\n\nReply with a number to pay that period.',
    sw:
      '*Lipa Mchango*\n\nVipindi ambavyo havijalipwa:\n\n{list}\n\nJibu kwa namba kulipa kipindi hicho.',
  },
  CONTRIB_AMOUNT: {
    en:
      '*{period}*\nAmount due: *{due}*\n\n' +
      'How much do you want to pay? Enter an amount in KES, or reply *FULL* to pay {due}.\n\n' +
      'Any excess is applied to your next period automatically.',
    sw:
      '*{period}*\nDeni: *{due}*\n\n' +
      'Unataka kulipa kiasi gani? Ingiza kiasi kwa KES, au jibu *ZOTE* kulipa {due}.\n\n' +
      'Ziada yoyote itatumika kwenye kipindi kijacho kiotomatiki.',
  },
  CONTRIB_AMOUNT_TOO_HIGH: {
    en: 'That is more than this period needs. Maximum for *{period}* is *{due}*.\n\nEnter an amount up to {due}:',
    sw: 'Hiyo ni zaidi ya kipindi hiki kinachohitaji. Kiwango cha juu kwa *{period}* ni *{due}*.\n\nIngiza kiasi hadi {due}:',
  },

  /* ---------------- loans ---------------- */
  LOAN_PRODUCTS: {
    en: '*Apply for a Loan*\n\nChoose a loan product:\n\n{list}',
    sw: '*Omba Mkopo*\n\nChagua aina ya mkopo:\n\n{list}',
  },
  LOAN_NO_PRODUCTS: {
    en: 'Your chama has no active loan products yet. Ask your treasurer to set one up.',
    sw: 'Chama chako hakina aina ya mkopo inayofanya kazi bado. Muombe mweka hazina aweke moja.',
  },
  LOAN_PENDING_EXISTS: {
    en:
      '⚠️ You already have a loan application awaiting approval:\n\n' +
      '{summary}\n\n' +
      'Wait for it to be approved or declined before applying again.',
    sw:
      '⚠️ Tayari una ombi la mkopo linalosubiri idhini:\n\n' +
      '{summary}\n\n' +
      'Subiri liidhinishwe au likataliwe kabla ya kuomba tena.',
  },
  LOAN_ASK_AMOUNT: {
    en:
      '*{productName}*\n{rateLabel}\nMaximum: *{maxAmount}* over up to *{maxTerm}* months\n\n' +
      'How much do you want to borrow? Enter an amount in KES:',
    sw:
      '*{productName}*\n{rateLabel}\nKiwango cha juu: *{maxAmount}* kwa hadi miezi *{maxTerm}*\n\n' +
      'Unataka kukopa kiasi gani? Ingiza kiasi kwa KES:',
  },
  LOAN_AMOUNT_RANGE: {
    en: 'Enter an amount between *{min}* and *{maxAmount}*:',
    sw: 'Ingiza kiasi kati ya *{min}* na *{maxAmount}*:',
  },
  LOAN_ASK_TERM: {
    en: 'Over how many months do you want to repay *{amount}*? (1 – {maxTerm}):',
    sw: 'Unataka kulipa *{amount}* kwa miezi mingapi? (1 – {maxTerm}):',
  },
  LOAN_TERM_RANGE: {
    en: 'Enter a number of months between 1 and {maxTerm}:',
    sw: 'Ingiza idadi ya miezi kati ya 1 na {maxTerm}:',
  },
  LOAN_ASK_PURPOSE: {
    en: 'What is the loan for? (Short description, or reply *SKIP*):',
    sw: 'Mkopo ni wa nini? (Maelezo mafupi, au jibu *RUKA*):',
  },
  LOAN_CONFIRM: {
    en:
      '*Confirm your loan application*\n\n' +
      '📄 Product: {productName}\n' +
      '💰 Principal: *{principal}*\n' +
      '📅 Term: {term} months\n' +
      '📈 Interest: {rateLabel}\n' +
      '🧾 Total interest: {totalInterest}\n' +
      '💵 Total repayable: *{totalPay}*\n' +
      '📆 Monthly instalment: *{installment}*\n' +
      '🎯 Purpose: {purpose}\n\n' +
      'This goes to your chair and treasurer for approval — no money moves yet.\n\n' +
      'Reply *YES* to submit, or *0* to go back.',
    sw:
      '*Thibitisha ombi lako la mkopo*\n\n' +
      '📄 Aina: {productName}\n' +
      '💰 Kiasi: *{principal}*\n' +
      '📅 Muda: miezi {term}\n' +
      '📈 Riba: {rateLabel}\n' +
      '🧾 Jumla ya riba: {totalInterest}\n' +
      '💵 Jumla ya kulipa: *{totalPay}*\n' +
      '📆 Malipo ya mwezi: *{installment}*\n' +
      '🎯 Madhumuni: {purpose}\n\n' +
      'Hili litaenda kwa mwenyekiti na mweka hazina kwa idhini — hakuna pesa inayohama bado.\n\n' +
      'Jibu *NDIYO* kutuma, au *0* kurudi nyuma.',
  },
  LOAN_SUBMITTED: {
    en:
      '✅ *Loan application submitted.*\n\n' +
      'Reference: *{ref}*\n' +
      'Amount: {principal} over {term} months\n' +
      'Status: Awaiting chair and treasurer approval\n\n' +
      'You will be notified once a decision is made.',
    sw:
      '✅ *Ombi la mkopo limetumwa.*\n\n' +
      'Kumbukumbu: *{ref}*\n' +
      'Kiasi: {principal} kwa miezi {term}\n' +
      'Hali: Linasubiri idhini ya mwenyekiti na mweka hazina\n\n' +
      'Utajulishwa uamuzi ukishafanywa.',
  },
  LOAN_NONE_REPAYABLE: {
    en: 'You have no active loans to repay right now. 🎉',
    sw: 'Huna mikopo inayoendelea ya kulipa kwa sasa. 🎉',
  },
  LOAN_PAY_SELECT: {
    en: '*Repay a Loan*\n\nYour loans:\n\n{list}\n\nReply with a number to choose.',
    sw: '*Lipa Mkopo*\n\nMikopo yako:\n\n{list}\n\nJibu kwa namba kuchagua.',
  },
  LOAN_PAY_AMOUNT: {
    en:
      '*{productName}* — instalment {n} of {total}\n' +
      'Due on: {dueDate}\n' +
      'Instalment balance: *{due}*\n' +
      'Loan balance: *{loanBalance}*\n\n' +
      'How much do you want to pay? Enter an amount, reply *FULL* for {due}, or *CLEAR* to settle the whole loan ({loanBalance}).',
    sw:
      '*{productName}* — awamu {n} kati ya {total}\n' +
      'Inatakiwa: {dueDate}\n' +
      'Salio la awamu: *{due}*\n' +
      'Salio la mkopo: *{loanBalance}*\n\n' +
      'Unataka kulipa kiasi gani? Ingiza kiasi, jibu *ZOTE* kwa {due}, au *MALIZA* kumaliza mkopo wote ({loanBalance}).',
  },
  LOAN_PAY_TOO_HIGH: {
    en: 'That is more than the loan balance of *{loanBalance}*.\n\nEnter an amount up to {loanBalance}:',
    sw: 'Hiyo ni zaidi ya salio la mkopo la *{loanBalance}*.\n\nIngiza kiasi hadi {loanBalance}:',
  },
  LOAN_BALANCE_NONE: {
    en: '*Loan Balance*\n\nYou have no loans on record with {chamaName}.',
    sw: '*Salio la Mkopo*\n\nHuna mikopo yoyote katika kumbukumbu za {chamaName}.',
  },

  /* ---------------- merry-go-round ---------------- */
  MGR_NONE: {
    en: 'You are not part of any merry-go-round pot in {chamaName} yet.',
    sw: 'Bado hujaingia kwenye mzunguko wowote katika {chamaName}.',
  },
  MGR_SELECT: {
    en: '*Merry-Go-Round*\n\nYour pots:\n\n{list}\n\nReply with a number to open one.',
    sw: '*Mzunguko*\n\nMizunguko yako:\n\n{list}\n\nJibu kwa namba kufungua mmoja.',
  },
  MGR_DETAIL: {
    en:
      '*{name}*\n' +
      '💰 Per period: *{amount}* ({frequency})\n' +
      '👥 Members: {memberCount}\n' +
      '🔄 Cycle {cycle}, period {period}\n' +
      '🎯 Next to receive: {next}\n' +
      '📍 Your queue position: {position}\n' +
      '💵 Estimated pool: {pool}\n\n' +
      '*This period:* {myStatus}\n' +
      '📊 You have paid {paidCount} and missed {missedCount} period(s)\n\n' +
      '{actions}',
    sw:
      '*{name}*\n' +
      '💰 Kwa kipindi: *{amount}* ({frequency})\n' +
      '👥 Wanachama: {memberCount}\n' +
      '🔄 Mzunguko {cycle}, kipindi {period}\n' +
      '🎯 Anayefuata kupokea: {next}\n' +
      '📍 Nafasi yako kwenye foleni: {position}\n' +
      '💵 Makadirio ya jumla: {pool}\n\n' +
      '*Kipindi hiki:* {myStatus}\n' +
      '📊 Umelipa vipindi {paidCount} na umekosa {missedCount}\n\n' +
      '{actions}',
  },
  MGR_ACTIONS_PAYABLE: {
    en: '1. Pay {amount} for this period\n2. View my payment history\n\n*0* Back  *00* My Chama menu',
    sw: '1. Lipa {amount} kwa kipindi hiki\n2. Angalia historia yangu ya malipo\n\n*0* Nyuma  *00* Menyu ya Chama',
  },
  MGR_ACTIONS_PAID: {
    en: '✅ Already paid for this period.\n\n1. View my payment history\n\n*0* Back  *00* My Chama menu',
    sw: '✅ Tayari umelipa kwa kipindi hiki.\n\n1. Angalia historia yangu ya malipo\n\n*0* Nyuma  *00* Menyu ya Chama',
  },
  MGR_DRAFT: {
    en: 'This pot is still a draft — the queue draw has not been done, so contributions are not open yet.',
    sw: 'Mzunguko huu bado ni rasimu — droo ya foleni haijafanyika, hivyo michango haijafunguliwa.',
  },

  /* ---------------- payment ---------------- */
  PAY_ASK_PHONE: {
    en:
      'Which number should we send the payment prompt to?\n\n' +
      'Reply *1* to use {registered}, or type another number (07XXXXXXXX):',
    sw:
      'Tutume ombi la malipo kwa namba gani?\n\n' +
      'Jibu *1* kutumia {registered}, au andika namba nyingine (07XXXXXXXX):',
  },
  PAY_CONFIRM: {
    en:
      '*Confirm payment*\n\n' +
      '{label}\n\n' +
      '🏦 Goes to {chamaName}: *{net}*\n' +
      '💳 Paystack fee: {paystackFee}\n' +
      '⚙️ MyChama fee: {ourFee}\n' +
      '━━━━━━━━━━━━━━\n' +
      '📱 You will be charged: *{gross}*\n' +
      '📞 On: {phone} ({provider})\n\n' +
      'Exactly {net} reaches the chama — fees are never taken from what you owe.\n\n' +
      'Reply *PAY* to send the prompt, or *0* to go back.',
    sw:
      '*Thibitisha malipo*\n\n' +
      '{label}\n\n' +
      '🏦 Inakwenda {chamaName}: *{net}*\n' +
      '💳 Ada ya Paystack: {paystackFee}\n' +
      '⚙️ Ada ya MyChama: {ourFee}\n' +
      '━━━━━━━━━━━━━━\n' +
      '📱 Utatozwa: *{gross}*\n' +
      '📞 Kwa: {phone} ({provider})\n\n' +
      'Kiasi cha {net} haswa kinafika chamani — ada hazikatwi kwenye deni lako.\n\n' +
      'Jibu *LIPA* kutuma ombi, au *0* kurudi nyuma.',
  },
  PAY_SENT: {
    en:
      '📲 *Payment prompt sent to {phone}.*\n\n' +
      'Enter your PIN on your phone to complete.\n' +
      'Reference: *{ref}*\n\n' +
      'Your record updates automatically once payment confirms — you do not need to wait here.',
    sw:
      '📲 *Ombi la malipo limetumwa kwa {phone}.*\n\n' +
      'Ingiza PIN kwenye simu yako kukamilisha.\n' +
      'Kumbukumbu: *{ref}*\n\n' +
      'Rekodi yako itasasishwa kiotomatiki malipo yakithibitishwa — huhitaji kusubiri hapa.',
  },
  PAY_FAILED: {
    en: '❌ We could not start that payment.\n\nReason: {reason}\n\nTry again in a moment, or pay your treasurer directly.',
    sw: '❌ Hatukuweza kuanzisha malipo hayo.\n\nSababu: {reason}\n\nJaribu tena baadaye, au mlipe mweka hazina moja kwa moja.',
  },
  PAY_NOT_ON_PLAN: {
    en:
      '💳 Paystack collection is not available on your chama\'s *Free* plan.\n\n' +
      'Pay your treasurer directly and ask them to record it, or ask your officials to upgrade.',
    sw:
      '💳 Ukusanyaji kupitia Paystack haupatikani kwenye mpango wa *Bure* wa chama chako.\n\n' +
      'Mlipe mweka hazina moja kwa moja aiweke kwenye rekodi, au waombe viongozi kuboresha mpango.',
  },
  PAY_NO_SPLIT: {
    en:
      '⚠️ Your chama has not finished setting up its settlement account, so online payment is not available yet.\n\n' +
      'Please pay your treasurer directly.',
    sw:
      '⚠️ Chama chako hakijakamilisha kuweka akaunti ya malipo, hivyo malipo mtandaoni hayapatikani bado.\n\n' +
      'Tafadhali mlipe mweka hazina moja kwa moja.',
  },
  PAY_RATE_LIMITED: {
    en: '⏳ You have started several payments in the last hour. Please complete or cancel those first, then try again.',
    sw: '⏳ Umeanzisha malipo kadhaa katika saa iliyopita. Tafadhali kamilisha au ghairi hayo kwanza, kisha jaribu tena.',
  },

  /* ---------------- generic ---------------- */
  PICK_NUMBER: {
    en: 'Please reply with one of the numbers shown above.',
    sw: 'Tafadhali jibu kwa mojawapo ya namba zilizoonyeshwa hapo juu.',
  },
  ENTER_VALID_AMOUNT: {
    en: 'Please enter a valid amount in KES (numbers only, minimum 10):',
    sw: 'Tafadhali ingiza kiasi sahihi kwa KES (namba tu, kiwango cha chini 10):',
  },
  UNAVAILABLE: {
    en: '⚠️ My Chama is temporarily unreachable. Please try again in a few minutes.',
    sw: '⚠️ Chama Changu hakipatikani kwa muda. Tafadhali jaribu tena baada ya dakika chache.',
  },
  NAV_HINT: {
    en: '\n\n*0* Back  •  *00* My Chama menu  •  *000* Exit',
    sw: '\n\n*0* Nyuma  •  *00* Menyu ya Chama  •  *000* Toka',
  },
  NAV_HINT_TOP: {
    en: '\n\n*0* Main menu  •  *000* Exit',
    sw: '\n\n*0* Menyu kuu  •  *000* Toka',
  },
  BACK_TO_MYCHAMA: {
    en: '↩️ Back to My Chama.',
    sw: '↩️ Rudi kwa Chama Changu.',
  },
};

function fill(template: string, replacements?: Record<string, string | number>): string {
  if (!replacements) {
    return template;
  }
  let out = template;
  Object.entries(replacements).forEach(([key, value]) => {
    out = out.split(`{${key}}`).join(String(value));
  });
  return out;
}

export function mcMsg(
  key: keyof typeof MC_MESSAGES | string,
  language: Lang,
  replacements?: Record<string, string | number>
): string {
  const entry = MC_MESSAGES[key];
  if (!entry) {
    return MC_MESSAGES.UNAVAILABLE[language];
  }
  return fill(entry[language] || entry.en, replacements);
}

export function mcMenu(
  key: keyof typeof MC_MENUS | string,
  language: Lang,
  replacements?: Record<string, string | number>
): string {
  const entry = MC_MENUS[key];
  if (!entry) {
    return MC_MESSAGES.UNAVAILABLE[language];
  }
  return fill(entry[language] || entry.en, replacements);
}
