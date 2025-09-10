import { createContext, useContext, useEffect, useState } from "react";

declare global {
  const grecaptcha: {
    enterprise: {
      ready: (cb: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: string }
      ) => Promise<string>;
    };
  };
}
interface Props {
  siteKey: string;
  children: React.ReactNode;
}

const providerContext = createContext<{
  token: string | null;
  siteKey: string;
  setToken: (token: string) => void;
}>({
  token: null,
  siteKey: '',
  setToken: () => {},
});

export const useRecaptcha = (action: string) => {
  const { token, siteKey, setToken } = useContext(providerContext)
  useEffect(() => {
    if (
      typeof grecaptcha !== "undefined"
    ) {
      grecaptcha.enterprise.ready(async () => {
        const token = await grecaptcha.enterprise.execute(siteKey, { action: 'action' })
        setToken(token)
      })
    }
  }, [siteKey, action, setToken])
  return { token }
}

export function RecaptchaProvider({ siteKey, children }: Props) {
    const [token, setToken] = useState<string | null>(null)


  return (
    <providerContext.Provider value={{ token, siteKey, setToken }}>
      {children}
    </providerContext.Provider>
  );
}