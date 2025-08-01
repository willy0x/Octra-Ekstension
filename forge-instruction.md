PS C:\Users\Administrator\Documents\Devs\Octra-Extension> npm run build

> vite-react-typescript-starter@0.0.0 build
> tsc -b && vite build

src/App.tsx:250:54 - error TS2307: Cannot find module '../utils/password' or its corresponding type declarations.

250           const { encryptWalletData } = await import('../utils/password');
                                                         ~~~~~~~~~~~~~~~~~~~


Found 1 error.