import SwiftUI
import SwiftData

struct AddManualTransactionView: View {
    @Environment(\.dismiss) var dismiss
    @State private var accountId: String = "" // preencher com account existente
    @State private var categoryId: String = ""
    @State private var descriptionText: String = ""
    @State private var amountText: String = ""
    @State private var date = Date()

    var body: some View {
        NavigationStack {
            Form {
                Section("Conta") {
                    TextField("Account ID", text: $accountId)
                }
                Section("Categoria") {
                    TextField("Category ID (opcional)", text: $categoryId)
                }
                Section("Detalhes") {
                    TextField("Descrição", text: $descriptionText)
                    TextField("Valor (use - para despesa)", text: $amountText)
                        .keyboardType(.decimalPad)
                    DatePicker("Data", selection: $date, displayedComponents: .date)
                }
            }
            .navigationTitle("Lançamento Manual")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        save()
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
    }

    func save() {
        guard let amount = Double(amountText) else { return }
        let payload: [String: Any] = [
            "account_id": accountId,
            "category_id": categoryId.isEmpty ? NSNull() : categoryId,
            "description": descriptionText,
            "amount": amount,
            "date": ISO8601DateFormatter().string(from: date)
        ]
        APIService.shared.postManualTransaction(payload: payload) { result in
            switch result {
            case .success(_):
                DispatchQueue.main.async {
                    dismiss()
                }
            case .failure(let err):
                print("Erro salvar manual", err)
            }
        }
    }
}
