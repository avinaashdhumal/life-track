// Static asset imports resolved by Metro (e.g. `import appIcon from '../assets/icon.png'`).
declare module '*.png' {
  const value: number | string;
  export default value;
}
declare module '*.jpg' {
  const value: number | string;
  export default value;
}
