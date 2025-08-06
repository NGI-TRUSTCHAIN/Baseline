export class VerifyTransactionResultCommand {
  constructor(
    public readonly workflowId: string,
    public readonly workstepId: string,
    public readonly transactionResult: string,
  ) {}
}
