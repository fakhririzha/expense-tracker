import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

function isNetworkReachable(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) {
  if (state.isConnected === false) return false;
  return state.isInternetReachable ?? true;
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    NetInfo.fetch().then((state) => {
      if (mounted) setIsOnline(isNetworkReachable(state));
    });
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (mounted) setIsOnline(isNetworkReachable(state));
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return isOnline;
}
