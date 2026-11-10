import { test } from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { GSC_SCOPE, serviceAccountJwt } from "../packages/search-access/index.ts";

test("service account JWT is RS256-signed with a read-only scope and a one-hour lifetime", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwt = serviceAccountJwt({ client_email: "reader@p.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() }, 1000);
  const [h, c, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  assert.equal(claims.scope, GSC_SCOPE);
  assert.ok(claims.scope.endsWith(".readonly"));
  assert.equal(claims.iss, "reader@p.iam.gserviceaccount.com");
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url")));
});
