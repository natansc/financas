import SwiftUI
import SwiftData

@main
struct FinancasApp: App {
    var body: some Scene {
        WindowGroup {
            DashboardView()
                .modelContainer(for: [TransactionModel.self])
        }
    }
}
