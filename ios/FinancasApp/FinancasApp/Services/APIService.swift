import Foundation

struct APIService {
    static let shared = APIService()
    let baseURL = URL(string: "http://172.16.20.152:8000/api/dashboard")! // substituir por IP local ou ngrok

    func fetchDashboard(completion: @escaping (Result<Data, Error>) -> Void) {
        let url = baseURL.appendingPathComponent("dashboard")
        URLSession.shared.dataTask(with: url) { data, resp, err in
            if let err = err { completion(.failure(err)); return }
            guard let data = data else { completion(.failure(NSError(domain:"", code:0))); return }
            completion(.success(data))
        }.resume()
    }

    func postManualTransaction(payload: [String: Any], completion: @escaping (Result<Data, Error>) -> Void) {
        let url = baseURL.appendingPathComponent("transactions/manual")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload, options: [])
        URLSession.shared.dataTask(with: req) { data, resp, err in
            if let err = err { completion(.failure(err)); return }
            guard let data = data else { completion(.failure(NSError(domain:"", code:0))); return }
            completion(.success(data))
        }.resume()
    }

    func postSync(completion: @escaping (Result<Data, Error>) -> Void) {
        let url = baseURL.appendingPathComponent("sync")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        URLSession.shared.dataTask(with: req) { data, resp, err in
            if let err = err { completion(.failure(err)); return }
            guard let data = data else { completion(.failure(NSError(domain:"", code:0))); return }
            completion(.success(data))
        }.resume()
    }
}
