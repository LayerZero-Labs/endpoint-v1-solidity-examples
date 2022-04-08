module.exports = {
    overrides: [
        {
          files: "*.sol",
          options: {
            bracketSpacing: false,
            printWidth: 145,
            tabWidth: 4,
            useTabs: false,
            singleQuote: false,
            explicitTypes: "always",
          },
        },
        {
            files: "*.ts",
            options: {
                printWidth: 145,
                tabWidth: 4,
                useTabs: false,
                semi: false,
                trailingComma: "es5",
            },
        },
        {
            files: "*.js",
            options: {
                printWidth: 145,
                tabWidth: 4,
                useTabs: false,
                semi: false,
                trailingComma: "es5",
            },
        },
    ],
}
