SELECT id, "userId", "createdAt" FROM audit_logs WHERE entity = 'ManualExpense' ORDER BY "createdAt" DESC LIMIT 10;
