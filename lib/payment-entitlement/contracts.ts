export interface PaymentEntitlementReadRepository {
  hasSuccessfulPaymentForExam(examId: string): Promise<boolean>;
}
