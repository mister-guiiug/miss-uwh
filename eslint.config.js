// Config partagée miss-* / mister-* (flat config, React 19, react-hooks,
// react-refresh). On ignore `dist/` et `supabase/` (SQL, hors lint JS/TS).
import base from '@mister-guiiug/dev-wpa-config/eslint-react';

export default [
  ...base,
  { ignores: ['dist/**', 'coverage/**', 'supabase/**'] },
];
