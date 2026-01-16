export default {
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  printWidth: 100,
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
  importOrder: [
    '^[^.]', // Third party modules
    '^[./]', // Local imports
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
