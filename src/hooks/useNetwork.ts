/**
 * useNetwork Hook
 * Reactive network state using @react-native-community/netinfo.
 * Provides real-time connectivity status throughout the app.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

export interface NetworkState {
  /** Whether the device has an active network connection */
  isConnected: boolean;
  /** Whether internet is actually reachable (not just connected to WiFi) */
  isInternetReachable: boolean | null;
  /** Network type: wifi, cellular, none, etc. */
  networkType: NetInfoStateType;
  /** Convenience: true when both connected AND internet reachable */
  isOnline: boolean;
}

/**
 * Hook to monitor network connectivity in real time.
 *
 * Usage:
 * ```
 * const { isOnline, isConnected, networkType } = useNetwork();
 * ```
 */
export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    networkType: NetInfoStateType.unknown,
    isOnline: true,
  });

  const mounted = useRef(true);

  const handleNetworkChange = useCallback((netState: NetInfoState) => {
    if (!mounted.current) return;

    const isConnected = netState.isConnected ?? false;
    // isInternetReachable can be null during initial checks
    const isInternetReachable = netState.isInternetReachable ?? isConnected;

    setState({
      isConnected,
      isInternetReachable: netState.isInternetReachable,
      networkType: netState.type,
      isOnline: isConnected && (isInternetReachable === true),
    });
  }, []);

  useEffect(() => {
    mounted.current = true;

    // Fetch initial state
    NetInfo.fetch().then(handleNetworkChange);

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [handleNetworkChange]);

  return state;
}

/**
 * One-shot check: is the device currently online?
 * Use this in non-hook contexts (services, utilities).
 */
export async function checkNetworkOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return (state.isConnected ?? false) && (state.isInternetReachable ?? true);
  } catch {
    return false;
  }
}

export default useNetwork;
