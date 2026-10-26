/**
 * MyChama Menus & Messages
 *
 * Every user-facing MyChama string lives here in English and Kiswahili so the
 * handlers stay free of inline copy. Placeholders use {braces} and are filled
 * by mcMsg(). Missing keys fail loudly rather than printing an empty bubble.
 */

export type Lang = 'en' | 'sw';

/** Bodies of the My Chama menus. The choices themselves are list rows: see MC_ROWS. */
export const MC_MENUS: Record<string, Record<Lang, string>> = {
  MYCHAMA_MENU: {
    en: '*My Chama* — {chamaName}\nSigned in as {memberName}\n\nWhat would you like to do?',
    sw: '*My Chama* — {chamaName}\nUmeingia kama {memberName}\n\nUngependa kufanya nini?',
  },

  STATEMENT_TYPE: {
    en: '*Get Statement*\n\nWhat would you like a statement of?',
    sw: '*Pata Taarifa*\n\nUnataka taarifa ya nini?',
  },

  STATEMENT_PERIOD: {
    en: '*Choose a period*\n\nWhich period should the statement cover?',
    sw: '*Chagua kipindi*\n\nTaarifa ifunike kipindi gani?',
  },

  PROVIDER: {
    en: '*Which mobile money network is {phone} on?*',
    sw: '*{phone} iko kwenye mtandao gani?*',
  },
};

type Bi = Record<Lang, string>;
export interface McRow {
  value: string;
  title: Bi;
  desc?: Bi;
}

/**
 * List rows for the fixed menus (title max 24, description max 72). `value` is the number the handler has always
 * parsed, so a tap and a typed number are the same thing.
 */
export const MC_ROWS: Record<'MYCHAMA_MENU' | 'STATEMENT_TYPE' | 'STATEMENT_PERIOD', McRow[]> = {
  MYCHAMA_MENU: [
    { value: '1', title: { en: 'Pay Contribution', sw: 'Lipa Mchango' }, desc: { en: 'Pay what is due for a period', sw: 'Lipa deni la kipindi' } },
    { value: '2', title: { en: 'Apply for a Loan', sw: 'Omba Mkopo' }, desc: { en: 'Choose a product and request it', sw: 'Chagua aina ya mkopo na uombe' } },
    { value: '3', title: { en: 'Repay a Loan', sw: 'Lipa Mkopo' }, desc: { en: 'Pay an instalment or clear the loan', sw: 'Lipa awamu au maliza mkopo' } },
    { value: '4', title: { en: 'Loan Balance', sw: 'Salio la Mkopo' }, desc: { en: 'See what you owe', sw: 'Ona unachodaiwa' } },
    { value: '5', title: { en: 'Merry-Go-Round', sw: 'Mzunguko' }, desc: { en: 'Your pots, queue and payments', sw: 'Mizunguko yako, foleni na malipo' } },
    { value: '6', title: { en: 'Get Statement', sw: 'Pata Taarifa' }, desc: { en: 'Contributions, loans, merry-go-round', sw: 'Michango, mikopo, mzunguko' } },
    { value: '7', title: { en: 'Switch Chama', sw: 'Badilisha Chama' }, desc: { en: 'Move to another of your chamas', sw: 'Hamia chama kingine chako' } },
    { value: '8', title: { en: 'Main Menu', sw: 'Menyu Kuu' }, desc: { en: 'Back to the SAMUHIA menu', sw: 'Rudi kwenye menyu ya SAMUHIA' } },
  ],
  STATEMENT_TYPE: [
    { value: '1', title: { en: 'Contributions', sw: 'Michango' } },
    { value: '2', title: { en: 'Loans', sw: 'Mikopo' } },
    { value: '3', title: { en: 'Merry-Go-Round', sw: 'Mzunguko' } },
    { value: '4', title: { en: 'Everything', sw: 'Yote' } },
  ],
  STATEMENT_PERIOD: [
    { value: '1', title: { en: 'This month', sw: 'Mwezi huu' } },
    { value: '2', title: { en: 'Last 3 months', sw: 'Miezi 3 iliyopita' } },
    { value: '3', title: { en: 'This year', sw: 'Mwaka huu' } },
    { value: '4', title: { en: 'All time', sw: 'Muda wote' } },
  ],
};

export const MC_MESSAGES: Record<string, Record<Lang, string>> = {
  /* ---------------- authentication ---------------- */
  AUTH_INTRO: {
    en:
      '*My Chama* 🏦\n\nChecking your membership using this WhatsApp number…',
    sw: '*My Chama* 🏦\n\nTunakagua uanachama wako kwa namba hii ya WhatsApp…',
  },
  AUTH_NOT_REGISTERED: {
    en:
      'We could not find a chama membership linked to this WhatsApp number.\n\n' +
      'Ask your chama treasurer to add this number to your member profile, then try again.',
    sw:
      'Hatujapata uanachama wa chama unaohusiana na namba hii ya WhatsApp.\n\n' +
      'Muombe mweka hazina wa chama chako aongeze namba hii kwenye wasifu wako, kisha jaribu tena.',
  },
  AUTH_ASK_PHONE: {
    en:
      '*My Chama* 🏦\n\n' +
      'We could not match this WhatsApp number to a chama membership.\n\n' +
      'If your membership is registered under a *different phone number*, enter that number (07XXXXXXXX or 01XXXXXXXX) to continue:',
    sw:
      '*My Chama* 🏦\n\n' +
      'Hatukuweza kuoanisha namba hii ya WhatsApp na uanachama wowote wa chama.\n\n' +
      'Kama uanachama wako umesajiliwa kwa *namba nyingine ya simu*, ingiza namba hiyo (07XXXXXXXX au 01XXXXXXXX) kuendelea:',
  },
  AUTH_PHONE_FORMAT: {
    en: 'That does not look like a valid Kenyan number. Enter it as 07XXXXXXXX or 01XXXXXXXX:',
    sw: 'Hiyo haionekani kuwa namba sahihi ya Kenya. Iingize kama 07XXXXXXXX au 01XXXXXXXX:',
  },
  AUTH_PHONE_NOT_MATCHED: {
    en:
      'We could not match that number to an active membership. You have *{remaining}* attempt(s) left.\n\n' +
      'Enter the phone number registered with your chama, or ask your treasurer to update your profile:',
    sw:
      'Hatukuweza kuoanisha namba hiyo na uanachama unaofanya kazi. Umebakiwa na majaribio *{remaining}*.\n\n' +
      'Ingiza namba ya simu iliyosajiliwa kwenye chama chako, au muombe mweka hazina asasishe wasifu wako:',
  },
  AUTH_ASK_ID_CLAIM: {
    en:
      'Thanks. For your security, enter the *last 4 digits* of the National ID of the member registered on that number:',
    sw:
      'Asante. Kwa usalama wako, ingiza *tarakimu 4 za mwisho* za Kitambulisho cha mwanachama aliyesajiliwa kwa namba hiyo:',
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
      '🔒 Majaribio mengi yasiyo sahihi. My Chama imefungwa kwenye namba hii kwa dakika *{minutes}*.\n\n' +
      'Kama huwa wewe, wasiliana na viongozi wa chama chako.',
  },
  AUTH_REAUTH: {
    en: '🔒 You have been idle for a while. Enter the last 4 digits of your National ID to continue:',
    sw: '🔒 Umekaa kimya kwa muda. Ingiza tarakimu 4 za mwisho za Kitambulisho chako ili kuendelea:',
  },
  SELECT_CHAMA: {
    en: 'You belong to more than one chama. Which one?',
    sw: 'Wewe ni mwanachama wa chama zaidi ya kimoja. Kipi?',
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
      '*Pay Contribution*\n\nOutstanding periods — choose one to pay:',
    sw:
      '*Lipa Mchango*\n\nVipindi ambavyo havijalipwa — chagua kimoja kulipa:',
  },
  CONTRIB_AMOUNT: {
    en:
      '*{period}*\nAmount due: *{due}*\n\n' +
      'How much do you want to pay? Enter any amount in KES (a part payment is fine), or tap *Pay full amount* to pay {due}.',
    sw:
      '*{period}*\nDeni: *{due}*\n\n' +
      'Unataka kulipa kiasi gani? Ingiza kiasi chochote kwa KES (unaweza kulipa kidogo kidogo), au gusa *Lipa kiasi chote* kulipa {due}.',
  },
  CONTRIB_AMOUNT_TOO_HIGH: {
    en: 'That is more than this period needs. Maximum for *{period}* is *{due}*.\n\nEnter an amount up to {due}:',
    sw: 'Hiyo ni zaidi ya kipindi hiki kinachohitaji. Kiwango cha juu kwa *{period}* ni *{due}*.\n\nIngiza kiasi hadi {due}:',
  },

  /* ---------------- loans ---------------- */
  LOAN_PRODUCTS: {
    en: '*Apply for a Loan*\n\nChoose a loan product:',
    sw: '*Omba Mkopo*\n\nChagua aina ya mkopo:',
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
    en: 'What is the loan for? Type a short description, or tap *Skip*.',
    sw: 'Mkopo ni wa nini? Andika maelezo mafupi, au gusa *Ruka*.',
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
      'Tap *Submit* to send it, or *Back* to change it.',
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
      'Gusa *Tuma* kuwasilisha, au *Nyuma* kubadilisha.',
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
    en: '*Repay a Loan*\n\nChoose the loan to repay:',
    sw: '*Lipa Mkopo*\n\nChagua mkopo wa kulipa:',
  },
  LOAN_PAY_AMOUNT: {
    en:
      '*{productName}* — instalment {n} of {total}\n' +
      'Due on: {dueDate}\n' +
      'Instalment balance: *{due}*\n' +
      'Loan balance: *{loanBalance}*\n\n' +
      'How much do you want to pay? Enter an amount, or tap *Pay instalment* for {due} or *Clear the loan* to settle everything ({loanBalance}).',
    sw:
      '*{productName}* — awamu {n} kati ya {total}\n' +
      'Inatakiwa: {dueDate}\n' +
      'Salio la awamu: *{due}*\n' +
      'Salio la mkopo: *{loanBalance}*\n\n' +
      'Unataka kulipa kiasi gani? Ingiza kiasi, au gusa *Lipa awamu* kwa {due} au *Maliza mkopo* kumaliza deni lote ({loanBalance}).',
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
    en: '*Merry-Go-Round*\n\nChoose a pot to open:',
    sw: '*Mzunguko*\n\nChagua mzunguko wa kufungua:',
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
      '📊 You have paid {paidCount} and missed {missedCount} period(s)\n' +
      '{arrearLine}\n' +
      'What would you like to do?',
    sw:
      '*{name}*\n' +
      '💰 Kwa kipindi: *{amount}* ({frequency})\n' +
      '👥 Wanachama: {memberCount}\n' +
      '🔄 Mzunguko {cycle}, kipindi {period}\n' +
      '🎯 Anayefuata kupokea: {next}\n' +
      '📍 Nafasi yako kwenye foleni: {position}\n' +
      '💵 Makadirio ya jumla: {pool}\n\n' +
      '*Kipindi hiki:* {myStatus}\n' +
      '📊 Umelipa vipindi {paidCount} na umekosa {missedCount}\n' +
      '{arrearLine}\n' +
      'Ungependa kufanya nini?',
  },
  MGR_PAY_AMOUNT: {
    en:
      '*{name}* — period {period}\n' +
      'This period: *{amount}*\n' +
      'Paid so far: *{paid}*\n' +
      'Still due: *{remaining}*\n\n' +
      'How much do you want to pay? Enter an amount in KES, or tap *Pay full amount* for {remaining}.',
    sw:
      '*{name}* — kipindi {period}\n' +
      'Kipindi hiki: *{amount}*\n' +
      'Umelipa hadi sasa: *{paid}*\n' +
      'Bado inadaiwa: *{remaining}*\n\n' +
      'Unataka kulipa kiasi gani? Ingiza kiasi kwa KES, au gusa *Lipa kiasi chote* kwa {remaining}.',
  },
  MGR_PAY_TOO_HIGH: {
    en: 'That is more than what is still due this period (*{remaining}*).\n\nEnter an amount up to {remaining}:',
    sw: 'Hiyo ni zaidi ya kinachodaiwa kwa kipindi hiki (*{remaining}*).\n\nIngiza kiasi hadi {remaining}:',
  },
  MGR_ARREAR_LINE: {
    en: '⚠️ You have unpaid arrears of *{amount}* in this pot.\n',
    sw: '⚠️ Una malimbikizo ya *{amount}* kwenye mzunguko huu.\n',
  },
  MGR_ARREAR_PAY_AMOUNT: {
    en:
      '*{name}* — arrears\n' +
      'Still owed: *{remaining}*\n\n' +
      'How much do you want to pay? Enter an amount in KES, or tap *Pay full amount* for {remaining}.',
    sw:
      '*{name}* — malimbikizo\n' +
      'Bado yanadaiwa: *{remaining}*\n\n' +
      'Unataka kulipa kiasi gani? Ingiza kiasi kwa KES, au gusa *Lipa kiasi chote* kwa {remaining}.',
  },
  MGR_DRAFT: {
    en: 'This pot is still a draft — the queue draw has not been done, so contributions are not open yet.',
    sw: 'Mzunguko huu bado ni rasimu — droo ya foleni haijafanyika, hivyo michango haijafunguliwa.',
  },

  /* ---------------- payment ---------------- */
  PAY_ASK_PHONE: {
    en:
      'Which number should we send the payment prompt to?\n\n' +
      'Tap *Use {registered}*, or type another Safaricom number (07XXXXXXXX or 01XXXXXXXX):',
    sw:
      'Tutume ombi la malipo kwa namba gani?\n\n' +
      'Gusa *Tumia {registered}*, au andika namba nyingine ya Safaricom (07XXXXXXXX au 01XXXXXXXX):',
  },
  PAY_CONFIRM: {
    en:
      '*Confirm payment*\n\n' +
      '{label}\n\n' +
      '🏦 Goes to {chamaName}: *{net}*\n' +
      '💳 Transaction cost: {transactionCost}\n' +
      '━━━━━━━━━━━━━━\n' +
      '📱 You will be charged: *{gross}*\n' +
      '📞 On: {phone} ({provider})\n\n' +
      'Exactly {net} reaches the chama — fees are never taken from what you owe.\n\n' +
      'Tap *Pay now* to send the prompt, or *Back* to change it.',
    sw:
      '*Thibitisha malipo*\n\n' +
      '{label}\n\n' +
      '🏦 Inakwenda {chamaName}: *{net}*\n' +
      '💳 Gharama ya muamala: {transactionCost}\n' +
      '━━━━━━━━━━━━━━\n' +
      '📱 Utatozwa: *{gross}*\n' +
      '📞 Kwa: {phone} ({provider})\n\n' +
      'Kiasi cha {net} haswa kinafika chamani — ada hazikatwi kwenye deni lako.\n\n' +
      'Gusa *Lipa sasa* kutuma ombi, au *Nyuma* kubadilisha.',
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
  PAY_SPLIT_RELINK: {
    en:
      '⚠️ Your chama\'s settlement account needs to be re-linked after our payments upgrade, so online payment is paused for now.\n\n' +
      'Ask your chair and treasurer to re-submit it in the MyChama app. Meanwhile, please pay your treasurer directly.',
    sw:
      '⚠️ Akaunti ya malipo ya chama chako inahitaji kuunganishwa upya baada ya maboresho ya mfumo wetu, hivyo malipo mtandaoni yamesitishwa kwa sasa.\n\n' +
      'Waombe mwenyekiti na mweka hazina waiwasilishe tena kwenye programu ya MyChama. Kwa sasa, tafadhali mlipe mweka hazina moja kwa moja.',
  },
  PAY_DUPLICATE: {
    en:
      '⏳ You already have a payment of *{net}* waiting for your PIN (ref *{ref}*).\n\n' +
      'Complete it on your phone, or wait a few minutes before trying again — this stops you being charged twice.',
    sw:
      '⏳ Tayari una malipo ya *{net}* yanayosubiri PIN yako (kumbukumbu *{ref}*).\n\n' +
      'Yakamilishe kwenye simu yako, au subiri dakika chache kabla ya kujaribu tena — hii inakuzuia kutozwa mara mbili.',
  },
  PAY_STALE_TARGET: {
    en: '⚠️ What you owe changed while you were setting this up, so nothing was charged. Please start again to see the latest amount.',
    sw: '⚠️ Kiasi unachodaiwa kimebadilika ulipokuwa unaandaa malipo, kwa hiyo hakuna kilichotozwa. Tafadhali anza tena uone kiasi cha sasa.',
  },
  PENDING_PAYMENTS: {
    en: '\n⏳ *Awaiting confirmation:* {list}\nThese update your balance automatically once confirmed.',
    sw: '\n⏳ *Yanasubiri uthibitisho:* {list}\nHaya yatasasisha salio lako kiotomatiki yakithibitishwa.',
  },
  PAY_RATE_LIMITED: {
    en: '⏳ You have started several payments in the last hour. Please complete or cancel those first, then try again.',
    sw: '⏳ Umeanzisha malipo kadhaa katika saa iliyopita. Tafadhali kamilisha au ghairi hayo kwanza, kisha jaribu tena.',
  },

  /* ---------------- generic ---------------- */
  PICK_NUMBER: {
    en: 'Please choose one of the options shown.',
    sw: 'Tafadhali chagua mojawapo ya chaguo zilizoonyeshwa.',
  },
  STATEMENT_DONE: {
    en: '📄 That is your statement. What next?',
    sw: '📄 Hiyo ndiyo taarifa yako. Tufanye nini sasa?',
  },
  ENTER_VALID_AMOUNT: {
    en: 'Please enter a valid amount in KES (numbers only, minimum 10):',
    sw: 'Tafadhali ingiza kiasi sahihi kwa KES (namba tu, kiwango cha chini 10):',
  },
  UNAVAILABLE: {
    en: '⚠️ My Chama is temporarily unreachable. Please try again in a few minutes.',
    sw: '⚠️ My Chama haipatikani kwa muda. Tafadhali jaribu tena baada ya dakika chache.',
  },
  BACK_TO_MYCHAMA: {
    en: '↩️ Back to My Chama.',
    sw: '↩️ Rudi kwa My Chama.',
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
