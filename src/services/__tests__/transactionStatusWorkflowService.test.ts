import { TransactionStatus } from "../../models/transaction";
import {
  TransactionStatusWorkflowService,
  transactionStatusWorkflowService,
} from "../transactionStatusWorkflowService";

describe("TransactionStatusWorkflowService", () => {
  let workflowService: TransactionStatusWorkflowService;

  beforeEach(() => {
    workflowService = new TransactionStatusWorkflowService();
  });

  describe("Base TransactionStatus transitions", () => {
    it("allows valid transitions from Pending", () => {
      expect(workflowService.isValidBaseTransition(TransactionStatus.Pending, TransactionStatus.Completed)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Pending, TransactionStatus.Failed)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Pending, TransactionStatus.Cancelled)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Pending, TransactionStatus.Review)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Pending, TransactionStatus.Pending)).toBe(true);
    });

    it("rejects invalid transitions from Pending", () => {
      expect(workflowService.isValidBaseTransition(TransactionStatus.Pending, TransactionStatus.Reversed)).toBe(false);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Pending, TransactionStatus.ClawedBack)).toBe(false);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Pending, TransactionStatus.Dispute)).toBe(false);
    });

    it("allows valid transitions from Completed", () => {
      expect(workflowService.isValidBaseTransition(TransactionStatus.Completed, TransactionStatus.Dispute)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Completed, TransactionStatus.Reversed)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Completed, TransactionStatus.ClawedBack)).toBe(true);
    });

    it("rejects invalid transitions from Completed", () => {
      expect(workflowService.isValidBaseTransition(TransactionStatus.Completed, TransactionStatus.Pending)).toBe(false);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Completed, TransactionStatus.Failed)).toBe(false);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Completed, TransactionStatus.Cancelled)).toBe(false);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Completed, TransactionStatus.Review)).toBe(false);
    });

    it("treats terminal states as having no outward transitions", () => {
      const terminalStatuses = [
        TransactionStatus.Failed,
        TransactionStatus.Cancelled,
        TransactionStatus.Reversed,
        TransactionStatus.ClawedBack,
      ];

      for (const terminal of terminalStatuses) {
        expect(workflowService.getAllowedBaseTransitions(terminal)).toEqual([]);
        expect(workflowService.isValidBaseTransition(terminal, TransactionStatus.Completed)).toBe(false);
        expect(workflowService.isValidBaseTransition(terminal, TransactionStatus.Pending)).toBe(false);
      }
    });

    it("allows valid transitions from Review and Dispute", () => {
      expect(workflowService.isValidBaseTransition(TransactionStatus.Review, TransactionStatus.Pending)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Review, TransactionStatus.Completed)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Review, TransactionStatus.Failed)).toBe(true);

      expect(workflowService.isValidBaseTransition(TransactionStatus.Dispute, TransactionStatus.Completed)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Dispute, TransactionStatus.Reversed)).toBe(true);
      expect(workflowService.isValidBaseTransition(TransactionStatus.Dispute, TransactionStatus.Failed)).toBe(true);
    });

    it("throws an error when validateBaseTransition is called with an invalid transition", () => {
      expect(() => {
        workflowService.validateBaseTransition(
          "tx-123",
          TransactionStatus.Completed,
          TransactionStatus.Pending,
        );
      }).toThrow(/Invalid transaction status transition from completed to pending/i);
    });

    it("does not throw when validateBaseTransition is called with an allowed transition", () => {
      expect(() => {
        workflowService.validateBaseTransition(
          "tx-123",
          TransactionStatus.Pending,
          TransactionStatus.Completed,
        );
      }).not.toThrow();
    });
  });

  describe("DetailedStatus transitions and history tracking", () => {
    it("transitions detailed status and tracks history", () => {
      const entry = workflowService.transition(
        "tx-001",
        "INITIATED",
        "KYC_VERIFYING",
        "test-runner",
        "Auto check",
      );

      expect(entry.fromStatus).toBe("INITIATED");
      expect(entry.toStatus).toBe("KYC_VERIFYING");
      expect(entry.updatedBy).toBe("test-runner");
      expect(entry.reason).toBe("Auto check");

      const history = workflowService.getHistory("tx-001");
      expect(history.length).toBe(1);
      expect(history[0]).toEqual(entry);
    });

    it("throws error for invalid detailed status transition", () => {
      expect(() => {
        workflowService.transition("tx-001", "INITIATED", "COMPLETED");
      }).toThrow(/Invalid state transition from INITIATED to COMPLETED/i);
    });

    it("returns explanations for statuses", () => {
      const explanation = workflowService.getStatusExplanation("COMPLETED");
      expect(explanation).toContain("successfully settled");
    });
  });
});
