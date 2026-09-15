import SwiftUI
import Charts
import SwiftData

struct DashboardView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \.date, order: .descending) var transactions: [TransactionModel]

    @State private var expensesByCategory: [(String, Double)] = []
    @State private var totalBalance: Double = 0.0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Saldo Total")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(totalBalance.formatted(.currency(code: Locale.current.currency?.identifier ?? "BRL")))
                                .font(.title)
                                .bold()
                        }
                        Spacer()
                        Button("Sincronizar") {
                            APIService.shared.postSync { _ in }
                        }
                    }
                    .padding()

                    // Donut / Pie Chart
                    Chart {
                        ForEach(expensesByCategory, id: \.0) { item in
                            SectorMark(
                                angle: .value("Valor", item.1),
                                innerRadius: .ratio(0.6),
                                angularInset: 1.0
                            )
                            .foregroundStyle(by: .value("Categoria", item.0))
                        }
                    }
                    .frame(height: 220)
                    .padding()

                    // Últimas transações
                    VStack(alignment: .leading) {
                        Text("Últimas transações")
                            .font(.headline)
                        ForEach(transactions.prefix(20)) { tx in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(tx.descriptionText ?? "Sem descrição")
                                        .font(.subheadline)
                                    Text(tx.date, style: .date)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                Text((tx.amount as NSDecimalNumber).doubleValue, format: .currency(code: Locale.current.currency?.identifier ?? "BRL"))
                                    .foregroundColor(tx.amount < 0 ? .red : .green)
                            }
                            .padding(.vertical, 6)
                        }
                    }
                    .padding()
                }
                .padding()
            }
            .navigationTitle("Finanças")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink("Adicionar") {
                        AddManualTransactionView()
                    }
                }
            }
            .task {
                loadDashboard()
            }
        }
    }

    func loadDashboard() {
        APIService.shared.fetchDashboard { result in
            switch result {
            case .success(let data):
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    DispatchQueue.main.async {
                        self.totalBalance = (json["total_balance"] as? Double) ?? 0.0
                        if let arr = json["expenses_by_category"] as? [[String: Any]] {
                            self.expensesByCategory = arr.map { ($0["category"] as? String ?? "Sem categoria", ($0["total"] as? Double ?? 0.0)) }
                        }
                    }
                }
            case .failure(let err):
                print("Erro dashboard", err)
            }
        }
    }
}
