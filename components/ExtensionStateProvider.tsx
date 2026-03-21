import React, { createContext, useContext, useEffect, useState } from 'react';



interface StateContextType {
}

const StateContext = createContext<StateContextType | null>(null);


export function ExtensionStateProvider({ children }: { children: React.ReactNode }) {


    return (
        <StateContext.Provider value={{
        }}>
            {children}
        </StateContext.Provider>
    );
}

export const useExtensionState = () => {
    const context = useContext(StateContext);
    if (!context) throw new Error("useExtensionState must be used within Provider");
    return context;
};