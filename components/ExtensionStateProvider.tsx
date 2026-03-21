import React, { createContext, useContext, useEffect, useState } from 'react';
// import { MissionMap, Mission } from '@/utils/interfaces';
import { getProjectMissionsStorageKey, getProjectAnnotationsStorageKey } from '@/utils/utils';



interface StateContextType {
    // loadMissions: (orgId: string, projectId: string) => Promise<MissionMap>;
    // saveMissions: (orgId: string, projectId: string, dockSn: string, missions: Mission[]) => Promise<void>;
    loadAnnotations: (orgId: string, projectId: string) => Promise<Annotation[]>;
    saveAnnotations: (orgId: string, projectId: string, annotations: Annotation[]) => Promise<void>;
}

const StateContext = createContext<StateContextType | null>(null);


export function ExtensionStateProvider({ children }: { children: React.ReactNode }) {

    const getProjectMissionsLocalStorageKey = (orgId: string, projectId: string) => `local:${getProjectMissionsStorageKey(orgId, projectId)}`;
    const getProjectAnnotationsLocalStorageKey = (orgId: string, projectId: string) => `local:${getProjectAnnotationsStorageKey(orgId, projectId)}`;

    // // --- MISSIONS ---
    // const loadMissions = async (orgId: string, projectId: string): Promise<MissionMap> => {
    //     const key = getProjectMissionsLocalStorageKey(orgId, projectId);
    //     const data = await storage.getItem<MissionMap>(key as any);
    //     return data || {};
    // };

    // const saveMissions = async (orgId: string, projectId: string, dockSn: string, updatedMissions: Mission[]) => {
    //     const key = getProjectMissionsLocalStorageKey(orgId, projectId);
    //     // 1. Get existing map for this project
    //     const currentMap = await loadMissions(orgId, projectId);
    //     // 2. Update only the specific dock
    //     const newMap = { ...currentMap, [dockSn]: updatedMissions };
    //     // 3. Save back to storage
    //     await storage.setItem(key as any, newMap);
    // };

    // --- ANNOTATIONS ---
    const loadAnnotations = async (orgId: string, projectId: string): Promise<Annotation[]> => {
        const key = getProjectAnnotationsLocalStorageKey(orgId, projectId);
        // Load the array, default to empty array if nothing exists yet
        const data = await storage.getItem<Annotation[]>(key as any);
        return data || [];
    };

    const saveAnnotations = async (orgId: string, projectId: string, annotations: Annotation[]) => {
        const key = getProjectAnnotationsLocalStorageKey(orgId, projectId);
        // Completely replace the existing list with the new array
        await storage.setItem(key as any, annotations);
    };

    return (
        <StateContext.Provider value={{
            // loadMissions,
            // saveMissions,
            loadAnnotations,
            saveAnnotations
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