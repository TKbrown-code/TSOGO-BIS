const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

export const signUpUser = async (credentials) => {
    try{
    const responds = await fetch(`${url}/functions/v1/signUp`, {
        method:"POST",
        headers:{
            "Content-Type":"application/json",
            "Authorization":`Bearer ${key}`
        },
        body: JSON.stringify(credentials)
    });
    
    return responds;
    } catch (error) {
        console.error("Failed to fetch:", error);
        throw error;
    }
}

export const sendOtp = async (credentials) => {
    try{
    const responds = await fetch(`${url}/functions/v1/sendOtp`, {
        method:"POST",
        headers:{
            "Content-Type":"application/json",
            "Authorization":`Bearer ${key}`
        },
        body: JSON.stringify(credentials)
    });
    
    return responds;
    } catch (error) {
        console.error("Failed to fetch:", error);
        throw error;
    }
}

