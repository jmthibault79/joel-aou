import { BreadcrumbType } from 'app/utils/navigation';
import {atom, Atom} from 'app/utils/subscribable';
import {Profile} from 'generated';
import {Runtime} from 'generated/fetch';
import * as React from 'react';

const {useEffect, useState} = React;

export interface RouteDataStore {
  title?: string;
  minimizeChrome?: boolean;
  helpContentKey?: string;
  breadcrumb?: BreadcrumbType;
  pathElementForTitle?: string;
  notebookHelpSidebarStyles?: boolean;
  contentFullHeightOverride?: boolean;
}

export const routeDataStore = atom<RouteDataStore>({});

interface AuthStore {
  authLoaded: boolean;
  isSignedIn: boolean;
}

export const authStore = atom<AuthStore>({authLoaded: false, isSignedIn: false});

interface ProfileStore {
  profile?: Profile;
}

export const profileStore = atom<ProfileStore>({});

export interface RuntimeOperation {
  promise: Promise<any>;
  operation: string;
  aborter: AbortController;
}

interface WorkspaceRuntimeOperationMap {
  [workspaceNamespace: string]: RuntimeOperation;
}

export interface RuntimeOpsStore {
  opsByWorkspaceNamespace: WorkspaceRuntimeOperationMap;
}

export const runtimeOpsStore = atom<RuntimeOpsStore>({opsByWorkspaceNamespace: {}});

export const updateRuntimeOpsStoreForWorkspaceNamespace = (workspaceNamespace: string, runtimeOperation: RuntimeOperation) => {
  const opsByWorkspaceNamespace = runtimeOpsStore.get().opsByWorkspaceNamespace;
  opsByWorkspaceNamespace[workspaceNamespace] = runtimeOperation;
  runtimeOpsStore.set({opsByWorkspaceNamespace: opsByWorkspaceNamespace});
};

export const markRuntimeOperationCompleteForWorkspace = (workspaceNamespace: string) => {
  const opsByWorkspaceNamespace = runtimeOpsStore.get().opsByWorkspaceNamespace;
  if (!!opsByWorkspaceNamespace[workspaceNamespace]) {
    delete opsByWorkspaceNamespace[workspaceNamespace];
    runtimeOpsStore.set({opsByWorkspaceNamespace: opsByWorkspaceNamespace});
  }
};

export const abortRuntimeOperationForWorkspace = (workspaceNamespace: string) => {
  const opsByWorkspaceNamespace = runtimeOpsStore.get().opsByWorkspaceNamespace;
  if (!!opsByWorkspaceNamespace[workspaceNamespace]) {
    const runtimeOperation = opsByWorkspaceNamespace[workspaceNamespace];
    runtimeOperation.aborter.abort();
    delete opsByWorkspaceNamespace[workspaceNamespace];
    runtimeOpsStore.set({opsByWorkspaceNamespace: opsByWorkspaceNamespace});
  }
};

// runtime store states: undefined(initial state) -> Runtime (user selected) <--> null (delete only - no recreate)
export interface RuntimeStore {
  workspaceNamespace: string | null | undefined;
  runtime: Runtime | null | undefined;
}

export const runtimeStore = atom<RuntimeStore>({workspaceNamespace: undefined, runtime: undefined});

/**
 * @name useStore
 * @description React hook that will trigger a render when the corresponding store's value changes
 *              this should only be used in function components
 * @param {Atom<T>} theStore A container for the value to be updated
 */
export function useStore<T>(theStore: Atom<T>) {
  const [value, setValue] = useState(theStore.get());
  useEffect(() => {
    return theStore.subscribe(v => setValue(v)).unsubscribe;
  }, [theStore]);
  return value;
}

/**
 * HOC that injects the value of the given store as a prop. When the store changes, the wrapped
 * component will re-render
 */
export const withStore = (theStore, name) => WrappedComponent => {
  return (props) => {
    const value = useStore(theStore);
    const storeProp = {[name]: value};
    return <WrappedComponent {...props} {...storeProp}/> ;
  };
};
