// Analytics and Insights Service for AI Planner
import { supabase } from './supabase-config.js'
import { PlannerService } from './planner-service.js'

export class AnalyticsService {
    // Get comprehensive user analytics
    static async getUserAnalytics() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const [
                itinerariesResult,
                destinationsResult,
                interactionsResult,
                feedbackResult
            ] = await Promise.all([
                PlannerService.getItineraries(),
                PlannerService.getSavedDestinations(),
                this.getAIInteractions(),
                this.getUserFeedback()
            ])

            if (!itinerariesResult.success) throw new Error(itinerariesResult.error)
            if (!destinationsResult.success) throw new Error(destinationsResult.error)

            const analytics = {
                overview: this.calculateOverviewStats(itinerariesResult.data, destinationsResult.data),
                travel_patterns: this.analyzeTravelPatterns(itinerariesResult.data),
                destination_insights: this.analyzeDestinationInsights(destinationsResult.data),
                budget_analysis: this.analyzeBudgetPatterns(itinerariesResult.data),
                seasonal_trends: this.analyzeSeasonalTrends(itinerariesResult.data),
                ai_usage: this.analyzeAIUsage(interactionsResult.data || []),
                user_satisfaction: this.analyzeUserSatisfaction(feedbackResult.data || []),
                recommendations: await this.generateRecommendations(itinerariesResult.data, destinationsResult.data)
            }

            return { success: true, data: analytics }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Get AI interactions
    static async getAIInteractions(limit = 100) {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data, error } = await supabase
                .from('ai_interactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(limit)

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Get user feedback
    static async getUserFeedback() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data, error } = await supabase
                .from('user_feedback')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Calculate overview statistics
    static calculateOverviewStats(itineraries, destinations) {
        const totalTrips = itineraries.length
        const completedTrips = itineraries.filter(trip => trip.status === 'completed').length
        const draftTrips = itineraries.filter(trip => trip.status === 'draft').length
        const totalDestinations = destinations.length
        const visitedDestinations = destinations.filter(dest => dest.visited).length

        const totalSpent = itineraries.reduce((sum, trip) => sum + (trip.estimated_cost || 0), 0)
        const averageTripCost = totalTrips > 0 ? totalSpent / totalTrips : 0

        const totalDays = itineraries.reduce((sum, trip) => sum + trip.duration_days, 0)
        const averageTripDuration = totalTrips > 0 ? totalDays / totalTrips : 0

        return {
            total_trips: totalTrips,
            completed_trips: completedTrips,
            draft_trips: draftTrips,
            completion_rate: totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0,
            total_destinations: totalDestinations,
            visited_destinations: visitedDestinations,
            exploration_rate: totalDestinations > 0 ? (visitedDestinations / totalDestinations) * 100 : 0,
            total_spent: totalSpent,
            average_trip_cost: averageTripCost,
            total_travel_days: totalDays,
            average_trip_duration: averageTripDuration
        }
    }

    // Analyze travel patterns
    static analyzeTravelPatterns(itineraries) {
        if (itineraries.length === 0) {
            return {
                preferred_duration: 'weekend',
                preferred_budget: 'mid',
                preferred_pace: 'balanced',
                most_common_month: null,
                travel_frequency: 0
            }
        }

        // Duration preferences
        const durationCounts = {}
        itineraries.forEach(trip => {
            const duration = trip.duration_days <= 3 ? 'weekend' : 
                           trip.duration_days <= 7 ? 'week' : 
                           trip.duration_days <= 14 ? 'fortnight' : 'month'
            durationCounts[duration] = (durationCounts[duration] || 0) + 1
        })

        // Budget preferences
        const budgetCounts = {}
        itineraries.forEach(trip => {
            budgetCounts[trip.budget_range] = (budgetCounts[trip.budget_range] || 0) + 1
        })

        // Pace preferences
        const paceCounts = {}
        itineraries.forEach(trip => {
            paceCounts[trip.pace] = (paceCounts[trip.pace] || 0) + 1
        })

        // Monthly patterns
        const monthlyCounts = {}
        itineraries.forEach(trip => {
            if (trip.start_date) {
                const month = new Date(trip.start_date).getMonth()
                monthlyCounts[month] = (monthlyCounts[month] || 0) + 1
            }
        })

        // Calculate travel frequency (trips per month)
        const firstTrip = new Date(Math.min(...itineraries.map(trip => new Date(trip.created_at))))
        const lastTrip = new Date(Math.max(...itineraries.map(trip => new Date(trip.created_at))))
        const monthsDiff = (lastTrip - firstTrip) / (1000 * 60 * 60 * 24 * 30)
        const travelFrequency = monthsDiff > 0 ? itineraries.length / monthsDiff : 0

        return {
            preferred_duration: this.getMostCommon(durationCounts, 'weekend'),
            preferred_budget: this.getMostCommon(budgetCounts, 'mid'),
            preferred_pace: this.getMostCommon(paceCounts, 'balanced'),
            most_common_month: this.getMostCommon(monthlyCounts, null),
            travel_frequency: travelFrequency,
            duration_distribution: durationCounts,
            budget_distribution: budgetCounts,
            pace_distribution: paceCounts,
            monthly_distribution: monthlyCounts
        }
    }

    // Analyze destination insights
    static analyzeDestinationInsights(destinations) {
        if (destinations.length === 0) {
            return {
                favorite_categories: [],
                most_visited: [],
                wishlist: [],
                rating_trends: []
            }
        }

        // Category analysis
        const categoryCounts = {}
        const categoryRatings = {}
        
        destinations.forEach(dest => {
            if (dest.category) {
                categoryCounts[dest.category] = (categoryCounts[dest.category] || 0) + 1
                if (dest.rating) {
                    if (!categoryRatings[dest.category]) {
                        categoryRatings[dest.category] = []
                    }
                    categoryRatings[dest.category].push(dest.rating)
                }
            }
        })

        // Calculate average ratings per category
        const categoryAverages = {}
        Object.keys(categoryRatings).forEach(category => {
            const ratings = categoryRatings[category]
            categoryAverages[category] = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        })

        // Most visited destinations
        const visited = destinations.filter(dest => dest.visited)
        const wishlist = destinations.filter(dest => !dest.visited)

        return {
            favorite_categories: Object.entries(categoryCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([category, count]) => ({
                    category,
                    count,
                    average_rating: categoryAverages[category] || 0
                })),
            most_visited: visited
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 5),
            wishlist: wishlist
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 5),
            rating_trends: this.calculateRatingTrends(destinations)
        }
    }

    // Analyze budget patterns
    static analyzeBudgetPatterns(itineraries) {
        if (itineraries.length === 0) {
            return {
                total_spent: 0,
                average_daily_cost: 0,
                budget_efficiency: 0,
                cost_trends: []
            }
        }

        const budgetData = itineraries.map(trip => ({
            budget_range: trip.budget_range,
            estimated_cost: trip.estimated_cost || 0,
            duration_days: trip.duration_days,
            travelers_count: trip.travelers_count || 1,
            created_at: trip.created_at
        }))

        const totalSpent = budgetData.reduce((sum, trip) => sum + trip.estimated_cost, 0)
        const totalDays = budgetData.reduce((sum, trip) => sum + trip.duration_days, 0)
        const averageDailyCost = totalDays > 0 ? totalSpent / totalDays : 0

        // Budget efficiency (how well you stick to budget)
        const budgetEfficiency = this.calculateBudgetEfficiency(budgetData)

        // Cost trends over time
        const costTrends = this.calculateCostTrends(budgetData)

        return {
            total_spent: totalSpent,
            average_daily_cost: averageDailyCost,
            budget_efficiency: budgetEfficiency,
            cost_trends: costTrends,
            budget_breakdown: this.calculateBudgetBreakdown(budgetData)
        }
    }

    // Analyze seasonal trends
    static analyzeSeasonalTrends(itineraries) {
        if (itineraries.length === 0) {
            return {
                seasonal_preferences: [],
                weather_impact: [],
                festival_travel: []
            }
        }

        const monthlyData = {}
        const seasonalData = {
            spring: [], // Mar-May
            summer: [], // Jun-Aug
            autumn: [], // Sep-Nov
            winter: []  // Dec-Feb
        }

        itineraries.forEach(trip => {
            if (trip.start_date) {
                const date = new Date(trip.start_date)
                const month = date.getMonth()
                const season = this.getSeason(month)

                monthlyData[month] = (monthlyData[month] || 0) + 1
                seasonalData[season].push(trip)
            }
        })

        return {
            seasonal_preferences: Object.entries(monthlyData)
                .sort(([,a], [,b]) => b - a)
                .map(([month, count]) => ({
                    month: parseInt(month),
                    month_name: new Date(0, month).toLocaleString('default', { month: 'long' }),
                    trip_count: count
                })),
            seasonal_distribution: {
                spring: seasonalData.spring.length,
                summer: seasonalData.summer.length,
                autumn: seasonalData.autumn.length,
                winter: seasonalData.winter.length
            },
            favorite_season: this.getMostCommon(
                Object.fromEntries(
                    Object.entries(seasonalData).map(([season, trips]) => [season, trips.length])
                ),
                'spring'
            )
        }
    }

    // Analyze AI usage patterns
    static analyzeAIUsage(interactions) {
        if (interactions.length === 0) {
            return {
                total_interactions: 0,
                most_common_intents: [],
                usage_trends: [],
                satisfaction_score: 0
            }
        }

        const intentCounts = {}
        const monthlyUsage = {}
        
        interactions.forEach(interaction => {
            if (interaction.intent) {
                intentCounts[interaction.intent] = (intentCounts[interaction.intent] || 0) + 1
            }
            
            const month = new Date(interaction.created_at).getMonth()
            monthlyUsage[month] = (monthlyUsage[month] || 0) + 1
        })

        return {
            total_interactions: interactions.length,
            most_common_intents: Object.entries(intentCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5),
            usage_trends: Object.entries(monthlyUsage)
                .sort(([a], [b]) => a - b)
                .map(([month, count]) => ({
                    month: parseInt(month),
                    month_name: new Date(0, month).toLocaleString('default', { month: 'short' }),
                    interactions: count
                })),
            average_confidence: interactions.reduce((sum, i) => sum + (i.confidence_score || 0), 0) / interactions.length
        }
    }

    // Analyze user satisfaction
    static analyzeUserSatisfaction(feedback) {
        if (feedback.length === 0) {
            return {
                average_rating: 0,
                total_feedback: 0,
                rating_distribution: {},
                common_suggestions: []
            }
        }

        const ratings = feedback.map(f => f.rating)
        const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length

        const ratingDistribution = {}
        ratings.forEach(rating => {
            ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1
        })

        // Extract common suggestions
        const allSuggestions = feedback.flatMap(f => f.suggestions || [])
        const suggestionCounts = {}
        allSuggestions.forEach(suggestion => {
            suggestionCounts[suggestion] = (suggestionCounts[suggestion] || 0) + 1
        })

        return {
            average_rating: averageRating,
            total_feedback: feedback.length,
            rating_distribution: ratingDistribution,
            common_suggestions: Object.entries(suggestionCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([suggestion, count]) => ({ suggestion, count }))
        }
    }

    // Generate personalized recommendations
    static async generateRecommendations(itineraries, destinations) {
        const recommendations = []

        // Destination recommendations based on interests
        const interests = this.extractInterestsFromItineraries(itineraries)
        const visitedDestinations = destinations.filter(d => d.visited).map(d => d.name)
        
        const destinationRecommendations = this.getDestinationRecommendations(interests, visitedDestinations)
        if (destinationRecommendations.length > 0) {
            recommendations.push({
                type: 'destination',
                title: 'Discover New Places',
                description: 'Based on your interests, here are some destinations you might enjoy',
                items: destinationRecommendations
            })
        }

        // Activity recommendations
        const activityRecommendations = this.getActivityRecommendations(interests)
        if (activityRecommendations.length > 0) {
            recommendations.push({
                type: 'activity',
                title: 'Try New Activities',
                description: 'Expand your travel experiences with these activities',
                items: activityRecommendations
            })
        }

        // Budget optimization recommendations
        const budgetRecommendations = this.getBudgetRecommendations(itineraries)
        if (budgetRecommendations.length > 0) {
            recommendations.push({
                type: 'budget',
                title: 'Optimize Your Travel Budget',
                description: 'Tips to make your travel more cost-effective',
                items: budgetRecommendations
            })
        }

        return recommendations
    }

    // Helper methods
    static getMostCommon(counts, defaultVal) {
        const entries = Object.entries(counts)
        if (entries.length === 0) return defaultVal
        
        return entries.sort(([,a], [,b]) => b - a)[0][0]
    }

    static getSeason(month) {
        if (month >= 2 && month <= 4) return 'spring'
        if (month >= 5 && month <= 7) return 'summer'
        if (month >= 8 && month <= 10) return 'autumn'
        return 'winter'
    }

    static calculateBudgetEfficiency(budgetData) {
        // Simple budget efficiency calculation
        // This would need more sophisticated logic in a real implementation
        return 85 // Placeholder
    }

    static calculateCostTrends(budgetData) {
        // Group by month and calculate average cost
        const monthlyCosts = {}
        budgetData.forEach(trip => {
            const month = new Date(trip.created_at).getMonth()
            if (!monthlyCosts[month]) {
                monthlyCosts[month] = { total: 0, count: 0 }
            }
            monthlyCosts[month].total += trip.estimated_cost
            monthlyCosts[month].count += 1
        })

        return Object.entries(monthlyCosts)
            .sort(([a], [b]) => a - b)
            .map(([month, data]) => ({
                month: parseInt(month),
                month_name: new Date(0, month).toLocaleString('default', { month: 'short' }),
                average_cost: data.total / data.count
            }))
    }

    static calculateBudgetBreakdown(budgetData) {
        const ranges = { budget: 0, mid: 0, luxury: 0 }
        budgetData.forEach(trip => {
            ranges[trip.budget_range] = (ranges[trip.budget_range] || 0) + 1
        })
        return ranges
    }

    static calculateRatingTrends(destinations) {
        // Group destinations by creation date and calculate average rating
        const monthlyRatings = {}
        destinations.forEach(dest => {
            if (dest.rating && dest.created_at) {
                const month = new Date(dest.created_at).getMonth()
                if (!monthlyRatings[month]) {
                    monthlyRatings[month] = { total: 0, count: 0 }
                }
                monthlyRatings[month].total += dest.rating
                monthlyRatings[month].count += 1
            }
        })

        return Object.entries(monthlyRatings)
            .sort(([a], [b]) => a - b)
            .map(([month, data]) => ({
                month: parseInt(month),
                month_name: new Date(0, month).toLocaleString('default', { month: 'short' }),
                average_rating: data.total / data.count
            }))
    }

    static extractInterestsFromItineraries(itineraries) {
        const interestCounts = {}
        itineraries.forEach(trip => {
            if (trip.interests) {
                Object.entries(trip.interests).forEach(([interest, value]) => {
                    if (value) {
                        interestCounts[interest] = (interestCounts[interest] || 0) + 1
                    }
                })
            }
        })
        return Object.keys(interestCounts).filter(interest => interestCounts[interest] > 0)
    }

    static getDestinationRecommendations(interests, visitedDestinations) {
        const allDestinations = [
            { name: 'Netarhat', category: 'hill_station', interests: ['mountains', 'photography'] },
            { name: 'Hundru Falls', category: 'waterfall', interests: ['waterfalls', 'photography'] },
            { name: 'Betla National Park', category: 'wildlife', interests: ['wildlife', 'adventure'] },
            { name: 'Deoghar', category: 'religious', interests: ['temples', 'history'] },
            { name: 'Saraikela', category: 'cultural', interests: ['tribal_culture', 'festivals'] }
        ]

        return allDestinations
            .filter(dest => !visitedDestinations.includes(dest.name))
            .filter(dest => dest.interests.some(interest => interests.includes(interest)))
            .slice(0, 3)
    }

    static getActivityRecommendations(interests) {
        const activities = {
            mountains: ['Trekking', 'Mountain photography', 'Sunrise viewing'],
            waterfalls: ['Waterfall photography', 'Swimming', 'Nature walks'],
            wildlife: ['Safari tours', 'Bird watching', 'Wildlife photography'],
            temples: ['Temple visits', 'Spiritual meditation', 'Religious ceremonies'],
            tribal_culture: ['Village visits', 'Cultural performances', 'Handicraft workshops']
        }

        return interests.flatMap(interest => activities[interest] || []).slice(0, 5)
    }

    static getBudgetRecommendations(itineraries) {
        const recommendations = []
        
        if (itineraries.length > 0) {
            const avgCost = itineraries.reduce((sum, trip) => sum + (trip.estimated_cost || 0), 0) / itineraries.length
            
            if (avgCost > 5000) {
                recommendations.push('Consider budget accommodations to reduce costs')
            }
            
            if (itineraries.filter(trip => trip.budget_range === 'luxury').length > 2) {
                recommendations.push('Try mid-range options for better value')
            }
            
            recommendations.push('Book accommodations in advance for better rates')
            recommendations.push('Consider off-season travel for lower prices')
        }

        return recommendations
    }
}
