import { Theme } from "@twilio-paste/core/theme";

export default function App({ Component, pageProps }) {
  return (
    <Theme.Provider theme="default">
      <Component {...pageProps} />
    </Theme.Provider>
  );
}
