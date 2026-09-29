import { sameOriginPath } from "../../src/lib/lead/refPath";
console.log("import ok", sameOriginPath("/a/..//evil.com"), sameOriginPath("/schools/x"));
