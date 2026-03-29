// Authentication Service
import { supabase } from './supabase-config.js'

export class AuthService {
    // Sign up with email and password
    static async signUp(email, password, userData = {}) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: userData
                }
            })
            
            if (error) throw error
            
            return {
                success: true,
                user: data.user,
                message: 'Check your email for verification link!'
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    // Sign in with email and password
    static async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })
            
            if (error) throw error
            
            return {
                success: true,
                user: data.user,
                message: 'Successfully signed in!'
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    // Sign out
    static async signOut() {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            
            return {
                success: true,
                message: 'Successfully signed out!'
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    // Reset password
    static async resetPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`
            })
            
            if (error) throw error
            
            return {
                success: true,
                message: 'Password reset email sent!'
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    // Update password
    static async updatePassword(newPassword) {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })
            
            if (error) throw error
            
            return {
                success: true,
                message: 'Password updated successfully!'
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    // Get current user
    static async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error) throw error
            return user
        } catch (error) {
            console.error('Error getting current user:', error.message)
            return null
        }
    }

    // Check if user is authenticated
    static async isAuthenticated() {
        const user = await this.getCurrentUser()
        return user !== null
    }
}
