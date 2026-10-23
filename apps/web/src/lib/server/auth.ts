import { LOCAL_USER_ID } from "@/lib/server/store";

export type ServerUser = {
    id: string;
    email: string;
};

export type ServerAuthContext = {
    user: ServerUser;
};

export async function getServerAuthContext(): Promise<ServerAuthContext> {
    return {
        user: {
            id: LOCAL_USER_ID,
            email: "local@localhost",
        },
    };
}

export async function requireServerUser(): Promise<ServerAuthContext> {
    return getServerAuthContext();
}
