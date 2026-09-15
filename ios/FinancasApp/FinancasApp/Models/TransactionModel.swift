import Foundation
import SwiftData

@Model
final class TransactionModel: Identifiable {
    @Attribute(.unique) var id: UUID
    var accountId: UUID
    var categoryId: UUID?
    var descriptionText: String?
    var amount: Decimal
    var date: Date
    var isManual: Bool
    var pluggyTransactionId: String?
    var rawPayload: String? // JSON string

    init(id: UUID = UUID(),
         accountId: UUID,
         categoryId: UUID? = nil,
         descriptionText: String? = nil,
         amount: Decimal,
         date: Date = Date(),
         isManual: Bool = false,
         pluggyTransactionId: String? = nil,
         rawPayload: String? = nil) {
        self.id = id
        self.accountId = accountId
        self.categoryId = categoryId
        self.descriptionText = descriptionText
        self.amount = amount
        self.date = date
        self.isManual = isManual
        self.pluggyTransactionId = pluggyTransactionId
        self.rawPayload = rawPayload
    }
}
