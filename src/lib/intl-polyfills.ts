/**
 * Hermes (React Native's JavaScript engine) has no Intl.PluralRules, which
 * every ICU plural message needs ("{count, plural, one {…} other {…}}") —
 * without it use-intl shows the message key instead of the text. Imported
 * first by the root layout; a no-op wherever the API exists.
 */
import "@formatjs/intl-pluralrules/polyfill.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/ja.js";
