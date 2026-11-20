declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    REVIEW_LOGIN_ID?: string;
    REVIEW_PASSWORD_SALT?: string;
    REVIEW_PASSWORD_HASH?: string;
    BUCKET?: R2Bucket;
  }
}
