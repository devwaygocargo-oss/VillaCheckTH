// Narrow existing-item access. Requests and responses travel through pipes only.
// This program is never invoked before the separate explicit rotation approval.
import Foundation
import Security

let service = "com.villacheck.production.green-sun-56847773"
let account = "diagnostic-automation"
func finish(_ object: [String: Any], _ code: Int32) -> Never {
    if let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) {
        FileHandle.standardOutput.write(data)
    }
    exit(code)
}
func fail(_ code: String) -> Never { finish(["ok": false, "code": code], 1) }
let input = FileHandle.standardInput.readDataToEndOfFile()
guard input.count <= 262144,
      let request = (try? JSONSerialization.jsonObject(with: input)) as? [String: Any],
      request["service"] as? String == service,
      request["account"] as? String == account,
      let operation = request["operation"] as? String,
      ["read", "update"].contains(operation) else { fail("KEYCHAIN_REQUEST_REJECTED") }
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account
]
func readExisting() -> (data: Data, reference: Data) {
    var result: CFTypeRef?
    var lookup = query
    lookup[kSecReturnData as String] = true
    lookup[kSecReturnPersistentRef as String] = true
    lookup[kSecMatchLimit as String] = kSecMatchLimitOne
    guard SecItemCopyMatching(lookup as CFDictionary, &result) == errSecSuccess,
          let item = result as? [String: Any],
          let data = item[kSecValueData as String] as? Data,
          let reference = item[kSecValuePersistentRef as String] as? Data else { fail("KEYCHAIN_EXISTING_ITEM_UNAVAILABLE") }
    return (data, reference)
}
let current = readExisting()
if operation == "read" {
    finish(["ok": true, "dataBase64": current.data.base64EncodedString()], 0)
}
guard let expectedText = request["expectedValueBase64"] as? String,
      let replacementText = request["replacementValueBase64"] as? String,
      let expected = Data(base64Encoded: expectedText),
      let replacement = Data(base64Encoded: replacementText),
      current.data == expected, replacement.count > 0 else { fail("KEYCHAIN_CONCURRENT_CHANGE_OR_INVALID_UPDATE") }
// Update only kSecValueData on the existing item; preserve its access control.
let exactItemQuery: [String: Any] = [kSecValuePersistentRef as String: current.reference]
guard SecItemUpdate(exactItemQuery as CFDictionary,
                    [kSecValueData as String: replacement] as CFDictionary) == errSecSuccess else {
    fail("KEYCHAIN_UPDATE_FAILED")
}
let readback = readExisting()
guard readback.reference == current.reference, readback.data == replacement else { fail("KEYCHAIN_READBACK_MISMATCH") }
finish(["ok": true, "updated": true, "readbackVerified": true], 0)
