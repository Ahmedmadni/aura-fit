import process from "node:process";
const supplied = process.env.AURA_SITE_URL;
if (!supplied) throw Error("AURA_SITE_URL is required");
let url;
try { url = new URL(supplied); } catch { throw Error("Invalid URL"); }
if (url.protocol !== "https:" || !url.hostname || url.username || url.password ||
    url.search || url.hash || (url.pathname !== "/" && url.pathname !== "") ||
    url.port || supplied !== url.origin && supplied !== url.origin + "/") {
  throw Error("Use only a published HTTPS origin without path, port, credentials or query");
}
if (/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(url.hostname) ||
    /^(example\.(?:com|org|net)|[^.]+\.localhost|.*\.local|.*\.internal)$/i.test(url.hostname) ||
    url.hostname.includes(":") ||
    /^(?:id-)?preview--/i.test(url.hostname) ||
    /(^|\.)example\.(?:com|org|net)$/i.test(url.hostname) ||
    /(^|\.)(lovable\.dev|github\.com|github\.io)$/i.test(url.hostname)) {
  throw Error("Editor, placeholder, private and developer-only domains are not valid Android targets");
}
console.log("Android target URL valid: HTTPS published origin format");
