// Setup Vitest partagé : jest-dom + stub matchMedia + mocks virtual:pwa-register.
// Depuis le socle 4.21.2, il rétablit aussi `URL.createObjectURL`, que le couple
// Vitest 5 / jsdom 30.1 casse — c'est ce qui a permis de retirer d'ici le relais
// posé en #128.
import '@mister-guiiug/dev-pwa-config/vitest-setup';
