Example of what AI needs to see:

  === FUNCTION UNIVERSE: Payment System ===

  Entry Points:
    → POST /api/payment → handlePayment()
    → POST /api/refund → handleRefund()

  Core Flow:
    handlePayment()
      → validatePaymentData()    [guards against invalid input]
      → getUserAccount()         [fetches context]
      → checkBalance()          [business rule check]
      → processCharge()         [main action]
        → callStripeAPI()       [external integration]
        → updateDatabase()      [state change]
        → sendNotification()    [side effect]
      → logTransaction()        [audit trail]

  Data Transformations:
    RawRequest → ValidatedPayment → ChargeAttempt → ChargeResult → Receipt

  Error Flows:
    validatePaymentData() can throw → InvalidPaymentError
    checkBalance() can throw → InsufficientFundsError
    callStripeAPI() can throw → PaymentGatewayError

  This gives AI the complete mental model without ever mentioning files. Is this the
  direction you're thinking? →