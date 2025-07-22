import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
const GOOGLE_CLIENT_ID = "55543187892-fkk9tafsivb4oil3ppm05i08njcf01bv.apps.googleusercontent.com";

function App() {
  const [categories, setCategories] = useState({});
  const [manufacturers, setManufacturers] = useState({});
  const [simulations, setSimulations] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('categories'); // 'categories', 'manufacturers', 'simulations', 'aircraft', 'edit', 'browse'
  const [sortBy, setSortBy] = useState('rating');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showAircraftForm, setShowAircraftForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showWelcomeEditor, setShowWelcomeEditor] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [archivedAircraft, setArchivedAircraft] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [userReviews, setUserReviews] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('');
  const [selectedFilterDeveloper, setSelectedFilterDeveloper] = useState('');
  const [topAircraft, setTopAircraft] = useState([]);
  const [recentAircraft, setRecentAircraft] = useState([]);
  const [allAircraft, setAllAircraft] = useState([]);
  const [analytics, setAnalytics] = useState({
    most_viewed: [],
    trending: [],
    category_analytics: [],
    total_views: 0
  });
  const [adminStats, setAdminStats] = useState({
    total_users: 0,
    total_aircraft: 0,
    archived_aircraft: 0,
    total_reviews: 0,
    recent_users_7_days: 0,
    recent_reviews_7_days: 0
  });
  const [developers, setDevelopers] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  
  // Browse page filters
  const [filters, setFilters] = useState({
    priceRange: [0, 200],
    selectedDevelopers: [],
    selectedManufacturers: [],
    selectedCategories: [],
    selectedRatings: [],
    selectedCompatibility: [],
    priceType: [], // ['Paid', 'Freeware']
    searchText: ''
  });
  const [filteredAircraft, setFilteredAircraft] = useState([]);
  const [allManufacturers, setAllManufacturers] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'ascending'
  });
  const [viewMode, setViewMode] = useState('detailed'); // 'detailed' or 'compact'
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  
  const [reviewFormData, setReviewFormData] = useState({
    title: '',
    content: '',
    ratings: {
      overall: 5,
      performance: 5,
      visual_quality: 5,
      flight_model: 5,
      systems_accuracy: 5
    }
  });
  
  const [aircraftFormData, setAircraftFormData] = useState({
    name: '',
    developer: '',
    aircraft_manufacturer: '',
    aircraft_model: '',
    variant: '',
    category: 'Commercial',
    price_type: 'Paid',
    price: '',
    description: '',
    image_url: '',
    cockpit_image_url: '',
    additional_images: [],
    release_date: '',
    compatibility: ['MS2024'],
    download_url: '',
    developer_website: '',
    features: []
  });

  useEffect(() => {
    if (currentView === 'categories') {
      fetchCategories();
    }
    if (currentView === 'viewall') {
      fetchAllAircraft();
    }
    if (currentView === 'browse') {
      fetchAllAircraft();
    }
    if (currentView === 'admin' && user?.is_admin) {
      fetchAdminStats();
    }
    checkAuthStatus();
    fetchDevelopers();
    fetchAllCategories();
    fetchTopAircraft();
    fetchRecentAircraft();
    fetchAnalytics();
    fetchWelcomeMessage();
    fetchAllManufacturers();
  }, [currentView]);

  // Apply filters whenever filters or allAircraft change
  useEffect(() => {
    if (allAircraft.length > 0) {
      applyFilters();
    }
  }, [filters, allAircraft]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        console.log('User authenticated:', data.user);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const fetchDevelopers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/developers`);
      const data = await response.json();
      setDevelopers(data);
    } catch (error) {
      console.error('Error fetching developers:', error);
    }
  };

  const fetchAllCategories = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/categories`);
      const data = await response.json();
      setAllCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTopAircraft = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/aircraft?sort_by=rating&limit=10`);
      const data = await response.json();
      // Filter and sort by rating, take top 10
      const sortedAircraft = data
        .filter(aircraft => aircraft.average_rating > 0)
        .sort((a, b) => b.average_rating - a.average_rating)
        .slice(0, 10);
      setTopAircraft(sortedAircraft);
    } catch (error) {
      console.error('Error fetching top aircraft:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    try {
      const params = new URLSearchParams();
      params.append('search', searchTerm);
      if (selectedFilterCategory) params.append('category', selectedFilterCategory);
      if (selectedFilterDeveloper) params.append('developer', selectedFilterDeveloper);
      
      console.log('Searching with params:', params.toString());
      const response = await fetch(`${BACKEND_URL}/api/aircraft?${params}`);
      const data = await response.json();
      
      console.log('Search results:', data);
      setSimulations(data);
      setCurrentView('simulations');
      setSelectedCategory('Search Results');
      setSelectedManufacturer(`"${searchTerm}"`);
    } catch (error) {
      console.error('Error searching aircraft:', error);
    }
  };

  const fetchRecentAircraft = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/aircraft`);
      const data = await response.json();
      // Sort by creation date and take the 3 most recent
      const recentAircraft = data
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 3);
      setRecentAircraft(recentAircraft);
    } catch (error) {
      console.error('Error fetching recent aircraft:', error);
    }
  };

  const fetchAllAircraft = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/aircraft`);
      const data = await response.json();
      // Sort by name for consistent display
      const sortedAircraft = data.sort((a, b) => a.name.localeCompare(b.name));
      setAllAircraft(sortedAircraft);
    } catch (error) {
      console.error('Error fetching all aircraft:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/aircraft-analytics`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchAdminStats = async () => {
    if (!user?.is_admin) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/stats`, {
        credentials: 'include'
      });
      const data = await response.json();
      setAdminStats(data);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

  // New functions for Browse page
  const fetchAllManufacturers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/aircraft`);
      const data = await response.json();
      const manufacturers = [...new Set(data.map(aircraft => aircraft.aircraft_manufacturer))];
      setAllManufacturers(manufacturers.sort());
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...allAircraft];

    // Text search
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(aircraft => 
        aircraft.name.toLowerCase().includes(searchLower) ||
        aircraft.developer.toLowerCase().includes(searchLower) ||
        aircraft.aircraft_manufacturer.toLowerCase().includes(searchLower) ||
        aircraft.description.toLowerCase().includes(searchLower)
      );
    }

    // Developer filter
    if (filters.selectedDevelopers.length > 0) {
      filtered = filtered.filter(aircraft => 
        filters.selectedDevelopers.includes(aircraft.developer)
      );
    }

    // Manufacturer filter
    if (filters.selectedManufacturers.length > 0) {
      filtered = filtered.filter(aircraft => 
        filters.selectedManufacturers.includes(aircraft.aircraft_manufacturer)
      );
    }

    // Category filter
    if (filters.selectedCategories.length > 0) {
      filtered = filtered.filter(aircraft => 
        filters.selectedCategories.includes(aircraft.category)
      );
    }

    // Price type filter
    if (filters.priceType.length > 0) {
      filtered = filtered.filter(aircraft => 
        filters.priceType.includes(aircraft.price_type)
      );
    }

    // Compatibility filter
    if (filters.selectedCompatibility.length > 0) {
      filtered = filtered.filter(aircraft => 
        filters.selectedCompatibility.some(compat => 
          aircraft.compatibility && aircraft.compatibility.includes(compat)
        )
      );
    }

    // Rating filter (assuming ratings are numbers like 4, 5)
    if (filters.selectedRatings.length > 0) {
      filtered = filtered.filter(aircraft => {
        const rating = Math.floor(aircraft.average_rating);
        return filters.selectedRatings.includes(rating);
      });
    }

    // Price range filter (extract numeric value from price string)
    const [minPrice, maxPrice] = filters.priceRange;
    filtered = filtered.filter(aircraft => {
      if (aircraft.price_type === 'Freeware') return minPrice === 0;
      
      const priceStr = aircraft.price;
      if (!priceStr) return true;
      
      const priceMatch = priceStr.match(/[\d.]+/);
      if (!priceMatch) return true;
      
      const price = parseFloat(priceMatch[0]);
      return price >= minPrice && price <= maxPrice;
    });

    setFilteredAircraft(filtered);
  };

  // Update filters helper
  const updateFilter = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Sorting functionality
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortedAircraft = () => {
    let sortableAircraft = [...filteredAircraft];
    if (sortConfig.key !== null) {
      sortableAircraft.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle special sorting cases
        if (sortConfig.key === 'price') {
          // Extract numeric value from price string
          const aPrice = a.price_type === 'Freeware' ? 0 : parseFloat(a.price?.match(/[\d.]+/)?.[0] || 0);
          const bPrice = b.price_type === 'Freeware' ? 0 : parseFloat(b.price?.match(/[\d.]+/)?.[0] || 0);
          aValue = aPrice;
          bValue = bPrice;
        } else if (sortConfig.key === 'view_count') {
          aValue = a.view_count || 0;
          bValue = b.view_count || 0;
        } else if (sortConfig.key === 'average_rating') {
          aValue = a.average_rating || 0;
          bValue = b.average_rating || 0;
        } else if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableAircraft;
  };

  const getSortIcon = (column) => {
    if (sortConfig.key === column) {
      return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
    }
    return '';
  };

  const fetchWelcomeMessage = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/welcome-message`);
      const data = await response.json();
      setWelcomeMessage(data.message);
    } catch (error) {
      console.error('Error fetching welcome message:', error);
      setWelcomeMessage('Welcome to FlightSimSpot! Your ultimate destination for Microsoft Flight Simulator aircraft reviews.');
    }
  };

  const updateWelcomeMessage = async (message) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/welcome-message`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ message })
      });
      
      if (response.ok) {
        setWelcomeMessage(message);
        return true;
      } else {
        console.error('Failed to update welcome message');
        return false;
      }
    } catch (error) {
      console.error('Error updating welcome message:', error);
      return false;
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    try {
      console.log('Google login attempt with credential:', credentialResponse.credential ? 'present' : 'missing');
      
      const response = await fetch(`${BACKEND_URL}/api/auth/google/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          credential: credentialResponse.credential
        })
      });

      console.log('Backend response status:', response.status);
      const data = await response.json();
      console.log('Backend response data:', data);
      
      if (data.status === 'success') {
        setUser(data.user);
        setShowLoginPrompt(false);
        console.log('Login successful:', data.user);
        alert(`Welcome ${data.user.name}! ${data.user.is_admin ? 'You have admin privileges.' : ''}`);
      } else {
        console.error('Login failed:', data);
        alert(`Login failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(`Login failed: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      setCurrentView('categories');
      alert('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const [categoriesRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/categories-with-counts`),
        fetch(`${BACKEND_URL}/api/stats`)
      ]);
      
      const categoriesData = await categoriesRes.json();
      const statsData = await statsRes.json();
      
      setCategories(categoriesData);
      setStats(statsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setLoading(false);
    }
  };

  const handleCategorySelect = async (category) => {
    try {
      setLoading(true);
      setSelectedCategory(category);
      
      const response = await fetch(`${BACKEND_URL}/api/aircraft-manufacturers/${category}`);
      const data = await response.json();
      
      setManufacturers(data);
      setCurrentView('manufacturers');
      setLoading(false);
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
      setLoading(false);
    }
  };

  const handleManufacturerSelect = async (manufacturer) => {
    try {
      setLoading(true);
      setSelectedManufacturer(manufacturer);
      
      const response = await fetch(`${BACKEND_URL}/api/simulations/${selectedCategory}/${manufacturer}?sort_by=${sortBy}`);
      const data = await response.json();
      
      setSimulations(data);
      setCurrentView('simulations');
      setLoading(false);
    } catch (error) {
      console.error('Error fetching simulations:', error);
      setLoading(false);
    }
  };

  const handleSortChange = async (newSortBy) => {
    setSortBy(newSortBy);
    if (currentView === 'simulations') {
      const response = await fetch(`${BACKEND_URL}/api/simulations/${selectedCategory}/${selectedManufacturer}?sort_by=${newSortBy}`);
      const data = await response.json();
      setSimulations(data);
    }
  };

  const openAircraftDetails = async (aircraftData) => {
    setSelectedAircraft(aircraftData);
    setCurrentView('aircraft');
    
    // Track page view
    try {
      await fetch(`${BACKEND_URL}/api/aircraft/${aircraftData.id}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.log('Error tracking view (non-critical):', error);
    }
    
    // Fetch reviews
    try {
      const response = await fetch(`${BACKEND_URL}/api/aircraft/${aircraftData.id}/reviews`);
      const reviewsData = await response.json();
      setReviews(reviewsData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    }
  };

  const closeAircraftDetails = () => {
    setSelectedAircraft(null);
    setCurrentView('simulations');
    setShowReviewForm(false);
  };

  const handleEditAircraft = () => {
    if (!user?.is_admin || !selectedAircraft) return;
    
    // Reset custom category state
    setShowCustomCategory(false);
    setCustomCategory('');
    
    setAircraftFormData({
      name: selectedAircraft.name,
      developer: selectedAircraft.developer,
      aircraft_manufacturer: selectedAircraft.aircraft_manufacturer,
      aircraft_model: selectedAircraft.aircraft_model,
      variant: selectedAircraft.variant,
      category: selectedAircraft.category,
      price_type: selectedAircraft.price_type,
      price: selectedAircraft.price || '',
      description: selectedAircraft.description,
      image_url: selectedAircraft.image_url || '',
      cockpit_image_url: selectedAircraft.cockpit_image_url || '',
      additional_images: selectedAircraft.additional_images || [],
      release_date: selectedAircraft.release_date || '',
      compatibility: selectedAircraft.compatibility || ['MS2024'],
      download_url: selectedAircraft.download_url || '',
      developer_website: selectedAircraft.developer_website || '',
      features: selectedAircraft.features || []
    });
    setCurrentView('edit');
  };

  const openAddAircraftForm = () => {
    // Reset custom category state
    setShowCustomCategory(false);
    setCustomCategory('');
    
    // Reset form data
    setAircraftFormData({
      name: '',
      developer: '',
      aircraft_manufacturer: '',
      aircraft_model: '',
      variant: '',
      category: allCategories[0] || 'Commercial',
      price_type: 'Paid',
      price: '',
      description: '',
      image_url: '',
      cockpit_image_url: '',
      additional_images: [],
      release_date: '',
      compatibility: ['MS2024'],
      download_url: '',
      developer_website: '',
      features: []
    });
    
    setShowAircraftForm(true);
  };

  const handleArchiveAircraft = async () => {
    if (!user?.is_admin || !selectedAircraft) return;
    
    if (confirm('Are you sure you want to archive this aircraft? It will be hidden from users but preserved in the database.')) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/aircraft/${selectedAircraft.id}/archive`, {
          method: 'POST',
          credentials: 'include'
        });
        
        const data = await response.json();
        if (response.ok) {
          alert('Aircraft archived successfully');
          setCurrentView('simulations');
          // Refresh the simulations list
          handleManufacturerSelect(selectedManufacturer);
        } else {
          alert(data.detail || 'Failed to archive aircraft');
        }
      } catch (error) {
        console.error('Error archiving aircraft:', error);
        alert('Failed to archive aircraft');
      }
    }
  };

  const handleWriteReview = () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    setShowReviewForm(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user || !selectedAircraft) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/aircraft/${selectedAircraft.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(reviewFormData)
      });

      const data = await response.json();
      if (response.ok) {
        const reviewsResponse = await fetch(`${BACKEND_URL}/api/aircraft/${selectedAircraft.id}/reviews`);
        const updatedReviews = await reviewsResponse.json();
        setReviews(updatedReviews);
        
        // Refresh aircraft data
        const aircraftResponse = await fetch(`${BACKEND_URL}/api/aircraft/${selectedAircraft.id}`);
        const updatedAircraft = await aircraftResponse.json();
        setSelectedAircraft(updatedAircraft);
        
        setReviewFormData({
          title: '',
          content: '',
          ratings: {
            overall: 5,
            performance: 5,
            visual_quality: 5,
            flight_model: 5,
            systems_accuracy: 5
          }
        });
        setShowReviewForm(false);
        alert('Review submitted successfully!');
      } else {
        alert(data.detail || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review');
    }
  };

  const handleAircraftSubmit = async (e) => {
    e.preventDefault();
    if (!user || !user.is_admin) return;

    try {
      let response;
      if (currentView === 'edit' && selectedAircraft) {
        response = await fetch(`${BACKEND_URL}/api/aircraft/${selectedAircraft.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(aircraftFormData)
        });
      } else {
        response = await fetch(`${BACKEND_URL}/api/aircraft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(aircraftFormData)
        });
      }

      const data = await response.json();
      if (response.ok) {
        alert(currentView === 'edit' ? 'Aircraft updated successfully!' : 'Aircraft added successfully!');
        setShowAircraftForm(false);
        
        if (currentView === 'edit') {
          // Refresh aircraft data and go back to aircraft view
          const updatedAircraftResponse = await fetch(`${BACKEND_URL}/api/aircraft/${selectedAircraft.id}`);
          const updatedAircraft = await updatedAircraftResponse.json();
          setSelectedAircraft(updatedAircraft);
          setCurrentView('aircraft');
        } else {
          // Go back to categories
          setCurrentView('categories');
        }
        
        // Reset form
        setAircraftFormData({
          name: '',
          developer: '',
          aircraft_manufacturer: '',
          aircraft_model: '',
          variant: '',
          category: 'Commercial',
          price_type: 'Paid',
          price: '',
          description: '',
          image_url: '',
          cockpit_image_url: '',
          additional_images: [],
          release_date: '',
          compatibility: ['MS2024'],
          download_url: '',
          developer_website: '',
          features: []
        });
      } else {
        alert(data.detail || `Failed to ${currentView === 'edit' ? 'update' : 'add'} aircraft`);
      }
    } catch (error) {
      console.error('Error with aircraft operation:', error);
      alert(`Failed to ${currentView === 'edit' ? 'update' : 'add'} aircraft`);
    }
  };

  const renderStars = (rating) => {
    if (!rating || rating === 0) return '☆☆☆☆☆'; // Show empty stars for 0 rating
    return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderNavigation = () => (
    <nav className="bg-white shadow-lg sticky top-0 z-40">
      {/* Main Header with Categories */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16 space-x-8">
            <button
              onClick={() => setCurrentView('categories')}
              className={`flex flex-col items-center px-3 py-2 text-sm font-medium hover:text-blue-300 transition-colors ${
                currentView === 'categories' ? 'text-blue-300' : 'text-white'
              }`}
            >
              <span className="text-lg mb-1">🏠</span>
              <span>Home</span>
            </button>

            <button
              onClick={() => setCurrentView('browse')}
              className={`flex flex-col items-center px-3 py-2 text-sm font-medium hover:text-blue-300 transition-colors ${
                currentView === 'browse' ? 'text-blue-300' : 'text-white'
              }`}
            >
              <span className="text-lg mb-1">✈️</span>
              <span>Aircraft</span>
            </button>
            <button
              onClick={() => setCurrentView('top10')}
              className={`flex flex-col items-center px-3 py-2 text-sm font-medium hover:text-blue-300 transition-colors ${
                currentView === 'top10' ? 'text-blue-300' : 'text-white'
              }`}
            >
              <span className="text-lg mb-1">🏆</span>
              <span>Top 10</span>
            </button>
            <button
              onClick={() => setCurrentView('mostviewed')}
              className={`flex flex-col items-center px-3 py-2 text-sm font-medium hover:text-blue-300 transition-colors ${
                currentView === 'mostviewed' ? 'text-blue-300' : 'text-white'
              }`}
            >
              <span className="text-lg mb-1">👀</span>
              <span>Most Viewed</span>
            </button>
            <button
              onClick={() => setCurrentView('trending')}
              className={`flex flex-col items-center px-3 py-2 text-sm font-medium hover:text-blue-300 transition-colors ${
                currentView === 'trending' ? 'text-blue-300' : 'text-white'
              }`}
            >
              <span className="text-lg mb-1">🔥</span>
              <span>Trending</span>
            </button>
            {user?.is_admin && (
              <>
                <button
                  onClick={() => openAddAircraftForm()}
                  className="flex flex-col items-center px-3 py-2 text-sm font-medium text-green-300 hover:text-green-100 transition-colors"
                >
                  <span className="text-lg mb-1">➕</span>
                  <span>Add Aircraft</span>
                </button>
                <button
                  onClick={() => setCurrentView('admin')}
                  className={`flex flex-col items-center px-3 py-2 text-sm font-medium hover:text-blue-300 transition-colors ${
                    currentView === 'admin' ? 'text-blue-300' : 'text-orange-300'
                  }`}
                >
                  <span className="text-lg mb-1">⚙️</span>
                  <span>Admin</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Header with Logo, Search, and User */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center">
              <button
                onClick={() => {
                  setCurrentView('categories');
                  setSelectedCategory('');
                  setSelectedManufacturer('');
                  setSelectedAircraft(null);
                }}
                className="text-2xl font-bold text-blue-800 hover:text-blue-600"
              >
                ✈️ FlightSimSpot
              </button>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Search aircraft..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-4 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-2 p-1 text-gray-400 hover:text-blue-600"
                >
                  🔍
                </button>
              </div>
            </div>

            {/* User Section */}
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="h-8 w-8 rounded-full"
                  />
                  <span className="text-sm font-medium text-gray-700">{user.name}</span>
                  {user.is_admin && (
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Admin</span>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleLogin}
                  onError={() => console.log('Login Failed')}
                  theme="outline"
                  size="medium"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {(selectedCategory || selectedManufacturer || selectedAircraft || currentView === 'edit') && (
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-10 text-sm">
              <button
                onClick={() => setCurrentView('categories')}
                className="text-blue-600 hover:text-blue-800"
              >
                Home
              </button>
              {selectedCategory && (
                <>
                  <span className="mx-2 text-gray-400">→</span>
                  <button
                    onClick={() => setCurrentView('manufacturers')}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {selectedCategory}
                  </button>
                </>
              )}
              {selectedManufacturer && (
                <>
                  <span className="mx-2 text-gray-400">→</span>
                  <button
                    onClick={() => setCurrentView('simulations')}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {selectedManufacturer}
                  </button>
                </>
              )}
              {selectedAircraft && currentView === 'aircraft' && (
                <>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="text-gray-600">{selectedAircraft.developer} {selectedAircraft.name}</span>
                </>
              )}
              {currentView === 'edit' && (
                <>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="text-gray-600">Edit Aircraft</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );

  const renderCategoriesView = () => (
    <>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white">
        <div className="relative">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1587408811730-1a978e6c407d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwzfHxhaXJjcmFmdHxlbnwwfHx8fDE3NTI5Mjg4OTF8MA&ixlib=rb-4.1.0&q=85"
              alt="Aircraft Cockpit"
              className="w-full h-full object-cover opacity-30"
            />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                FlightSimSpot
              </h1>
              <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
                Your ultimate destination for flight simulation reviews and ratings
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="text-3xl font-bold">{stats.total_aircraft}</div>
                  <div className="text-sm opacity-90">Aircraft</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="text-3xl font-bold">{stats.total_reviews}</div>
                  <div className="text-sm opacity-90">Reviews</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="text-3xl font-bold">{stats.paid_aircraft}</div>
                  <div className="text-sm opacity-90">Paid</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="text-3xl font-bold">{stats.free_aircraft}</div>
                  <div className="text-sm opacity-90">Freeware</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Message Section */}
      <div className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {user?.is_admin && (
              <button
                onClick={() => setShowWelcomeEditor(true)}
                className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
              >
                ✏️ Edit Welcome Message
              </button>
            )}
            <div className="prose prose-lg mx-auto text-gray-700">
              <div className="mb-4">
                {welcomeMessage ? (
                  <p>{welcomeMessage}</p>
                ) : (
                  <>
                    <p className="mb-4">
                      Welcome to FlightSimSpot, the premier destination for flight simulation enthusiasts seeking honest, detailed reviews of aircraft for Microsoft Flight Simulator 2024 and 2020. Our mission is simple: to help simmers discover the best aircraft experiences, whether you're searching for study-level commercial jets, authentic general aviation aircraft, or specialised military and helicopter simulations. Every aircraft in our database is carefully reviewed, providing you with genuine insights into flight models, system depth, visual quality, and overall value.
                    </p>
                    <p>
                      FlightSimSpot aims to catalogue all available aircraft and reviews of both premium payware and exceptional freeware aircraft. As we grow, we're expanding beyond aircraft to include scenery, hardware reviews, and comprehensive flight simulation resources. Whether you're a seasoned virtual aviator or just beginning your flight sim journey, you'll find everything you need to make informed decisions about your next virtual cockpit adventure.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Added Section */}
      {recentAircraft.length > 0 && (
        <div className="bg-gray-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Recently Added Aircraft</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {recentAircraft.map((aircraft) => (
                <div
                  key={aircraft.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
                  onClick={() => openAircraftDetails(aircraft)}
                >
                  <div className="aspect-video bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                    <img
                      src={aircraft.image_url}
                      alt={aircraft.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.innerHTML = `
                          <div class="text-white text-center">
                            <div class="text-4xl mb-2">✈️</div>
                            <div class="text-sm">${aircraft.variant}</div>
                          </div>
                        `;
                      }}
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{aircraft.developer} {aircraft.name}</h3>
                        <p className="text-sm text-gray-500">{aircraft.variant}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        aircraft.price_type === 'Paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {aircraft.price_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{aircraft.description}</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="text-yellow-400 text-lg">{renderStars(aircraft.average_rating)}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          {aircraft.average_rating} ({aircraft.total_reviews})
                        </span>
                      </div>
                      <span className="text-lg font-bold text-blue-600">{aircraft.price}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trending Aircraft Section */}
      {analytics.trending && analytics.trending.length > 0 ? (
        <div className="bg-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">🔥 Trending Aircraft</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {analytics.trending.slice(0, 3).map((aircraft) => (
                <div
                  key={aircraft.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border-2 border-orange-200"
                  onClick={() => openAircraftDetails(aircraft)}
                >
                  <div className="aspect-video bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                    <img
                      src={aircraft.image_url}
                      alt={aircraft.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.innerHTML = `
                          <div class="text-white text-center">
                            <div class="text-4xl mb-2">🔥</div>
                            <div class="text-sm">${aircraft.variant || aircraft.name}</div>
                          </div>
                        `;
                      }}
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{aircraft.developer} {aircraft.name}</h3>
                        <p className="text-sm text-gray-500">{aircraft.variant || aircraft.aircraft_model}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                        Trending
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{aircraft.description}</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="text-yellow-400 text-lg">{renderStars(aircraft.average_rating)}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          {aircraft.average_rating || 0} ({aircraft.total_reviews || 0})
                        </span>
                      </div>
                      <span className="text-lg font-bold text-blue-600">{aircraft.price}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Fallback: Show most recent 3 aircraft if no trending data
        recentAircraft.length > 0 && (
          <div className="bg-white py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">🔥 Popular Aircraft</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {recentAircraft.slice(0, 3).map((aircraft) => (
                  <div
                    key={aircraft.id}
                    className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border-2 border-orange-200"
                    onClick={() => openAircraftDetails(aircraft)}
                  >
                    <div className="aspect-video bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                      <img
                        src={aircraft.image_url}
                        alt={aircraft.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentNode.innerHTML = `
                            <div class="text-white text-center">
                              <div class="text-4xl mb-2">🔥</div>
                              <div class="text-sm">${aircraft.variant || aircraft.name}</div>
                            </div>
                          `;
                        }}
                      />
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{aircraft.developer} {aircraft.name}</h3>
                          <p className="text-sm text-gray-500">{aircraft.variant || aircraft.aircraft_model}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                          Popular
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{aircraft.description}</p>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <span className="text-yellow-400 text-lg">{renderStars(aircraft.average_rating)}</span>
                          <span className="text-sm text-gray-600 ml-2">
                            {aircraft.average_rating || 0} ({aircraft.total_reviews || 0})
                          </span>
                        </div>
                        <span className="text-lg font-bold text-blue-600">{aircraft.price}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </>
  );

  const renderManufacturersView = () => (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => setCurrentView('categories')}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Back to Categories
          </button>
          <h2 className="text-3xl font-bold text-gray-900">
            {selectedCategory} Aircraft Manufacturers
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {Object.entries(manufacturers).map(([manufacturerName, data]) => (
          <div
            key={manufacturerName}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border-l-4 border-green-500"
            onClick={() => handleManufacturerSelect(manufacturerName)}
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{manufacturerName}</h3>
            <p className="text-gray-600 mb-4">
              {data.count} aircraft available
            </p>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Models:</p>
              <div className="flex flex-wrap gap-2">
                {data.models.slice(0, 3).map((model, index) => (
                  <span key={index} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                    {model}
                  </span>
                ))}
                {data.models.length > 3 && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                    +{data.models.length - 3} more
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Avg Rating: {data.avg_rating} ★
              </div>
              <div className="text-green-600 font-medium">
                View Simulations →
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSimulationsView = () => (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => setCurrentView('manufacturers')}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Back to {selectedCategory} Manufacturers
          </button>
          <h2 className="text-3xl font-bold text-gray-900">
            {selectedManufacturer} Simulations
          </h2>
          <p className="text-gray-600">{simulations.length} aircraft available</p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="rating">Highest Rated</option>
            <option value="reviews">Most Reviews</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {simulations.map((aircraft) => (
          <div
            key={aircraft.id}
            className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
            onClick={() => openAircraftDetails(aircraft)}
          >
            <div className="aspect-video bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <img
                src={aircraft.image_url}
                alt={aircraft.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerHTML = `
                    <div class="text-white text-center">
                      <div class="text-4xl mb-2">✈️</div>
                      <div class="text-sm">${aircraft.variant}</div>
                    </div>
                  `;
                }}
              />
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{aircraft.developer} {aircraft.name}</h3>
                  <p className="text-sm text-gray-500">{aircraft.variant}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  aircraft.price_type === 'Paid'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {aircraft.price_type}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">{aircraft.description}</p>
              
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <span className="text-yellow-400 text-lg">{renderStars(aircraft.average_rating)}</span>
                  <span className="text-sm text-gray-600 ml-2">
                    {aircraft.average_rating} ({aircraft.total_reviews})
                  </span>
                </div>
                <span className="text-lg font-bold text-blue-600">{aircraft.price}</span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {aircraft.compatibility.map(compat => (
                  <span key={compat} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {compat}
                  </span>
                ))}
              </div>

              {aircraft.features && aircraft.features.length > 0 && (
                <div className="text-xs text-gray-500">
                  Features: {aircraft.features.slice(0, 2).join(', ')}
                  {aircraft.features.length > 2 && '...'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAircraftDetailView = () => {
    if (!selectedAircraft) return null;

    // Collect all images including additional ones
    const allImages = [
      selectedAircraft.image_url,
      selectedAircraft.cockpit_image_url,
      ...(selectedAircraft.additional_images || [])
    ].filter(img => img && img.trim() !== '');

    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={closeAircraftDetails}
              className="text-blue-600 hover:text-blue-800 mb-2"
            >
              ← Back to {selectedManufacturer} Simulations
            </button>
            <h1 className="text-4xl font-bold text-gray-900">
              {selectedAircraft.developer} {selectedAircraft.name}
            </h1>
            <p className="text-xl text-gray-600">{selectedAircraft.variant}</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {user?.is_admin && (
              <>
                <button
                  onClick={handleEditAircraft}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm"
                >
                  Edit Aircraft
                </button>
                <button
                  onClick={handleArchiveAircraft}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
                >
                  Archive Aircraft
                </button>
              </>
            )}
          </div>
        </div>

        {/* Images Gallery */}
        {allImages.length > 0 && (
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4">Screenshots</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allImages.map((imageUrl, index) => (
                <div key={index} className="aspect-video bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={`${selectedAircraft.name} - Image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentNode.innerHTML = `
                        <div class="flex items-center justify-center h-full text-white text-center">
                          <div>
                            <div class="text-4xl mb-2">✈️</div>
                            <div class="text-sm">Image ${index + 1}</div>
                          </div>
                        </div>
                      `;
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-2xl font-semibold mb-4">Aircraft Details</h3>
            <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><strong>Developer:</strong> {selectedAircraft.developer}</div>
                <div><strong>Aircraft Manufacturer:</strong> {selectedAircraft.aircraft_manufacturer}</div>
                <div><strong>Model:</strong> {selectedAircraft.aircraft_model}</div>
                <div><strong>Variant:</strong> {selectedAircraft.variant}</div>
                <div><strong>Category:</strong> {selectedAircraft.category}</div>
                <div><strong>Price:</strong> {selectedAircraft.price} ({selectedAircraft.price_type})</div>
                <div><strong>Compatibility:</strong> {selectedAircraft.compatibility.join(', ')}</div>
                <div><strong>Release Date:</strong> {selectedAircraft.release_date}</div>
              </div>
              
              <div className="mt-6">
                <strong>Description:</strong>
                <p className="mt-2 text-gray-700">{selectedAircraft.description}</p>
              </div>
              
              {selectedAircraft.features && selectedAircraft.features.length > 0 && (
                <div className="mt-6">
                  <strong>Features:</strong>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedAircraft.features.map((feature, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex space-x-4 mt-6">
                {selectedAircraft.developer_website && (
                  <a
                    href={selectedAircraft.developer_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Developer Site
                  </a>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-semibold">
                Reviews ({selectedAircraft.total_reviews})
              </h3>
              <button
                onClick={handleWriteReview}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Write Review
              </button>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="text-4xl font-bold text-yellow-500 mb-2">
                {renderStars(selectedAircraft.average_rating)}
              </div>
              <div className="text-sm text-gray-600">
                {selectedAircraft.average_rating} out of 5 ({selectedAircraft.total_reviews} reviews)
              </div>
            </div>

            {/* Review Form */}
            {showReviewForm && (
              <div className="mb-6 bg-white rounded-xl shadow-lg p-6">
                <h4 className="text-xl font-semibold mb-4">Write Your Review</h4>
                <form onSubmit={handleReviewSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Title</label>
                    <input
                      type="text"
                      value={reviewFormData.title}
                      onChange={(e) => setReviewFormData({...reviewFormData, title: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Review</label>
                    <textarea
                      value={reviewFormData.content}
                      onChange={(e) => setReviewFormData({...reviewFormData, content: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2 h-24"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {Object.entries(reviewFormData.ratings).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium mb-1 capitalize">
                          {key.replace('_', ' ')}
                        </label>
                        <select
                          value={value}
                          onChange={(e) => setReviewFormData({
                            ...reviewFormData,
                            ratings: {...reviewFormData.ratings, [key]: parseInt(e.target.value)}
                          })}
                          className="w-full border rounded px-2 py-1 text-sm"
                        >
                          {[1,2,3,4,5].map(rating => (
                            <option key={rating} value={rating}>{rating} Stars</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Submit Review
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReviewForm(false)}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {reviews.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No reviews yet. Be the first to review this aircraft!</p>
                  </div>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-3">
                          {review.user_avatar && (
                            <img
                              src={review.user_avatar}
                              alt={review.user_name}
                              className="h-8 w-8 rounded-full"
                            />
                          )}
                          <div>
                            <h4 className="font-semibold">{review.title}</h4>
                            <p className="text-sm text-gray-600">
                              by {review.user_name} • {formatDate(review.created_at)}
                            </p>
                          </div>
                        </div>
                        <span className="text-yellow-400">{renderStars(review.ratings.overall)}</span>
                      </div>
                      <p className="text-sm mb-3">{review.content}</p>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>Performance: {renderStars(review.ratings.performance)}</div>
                        <div>Visual: {renderStars(review.ratings.visual_quality)}</div>
                        <div>Flight Model: {renderStars(review.ratings.flight_model)}</div>
                        <div>Systems: {renderStars(review.ratings.systems_accuracy)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEditAircraftView = () => {
    if (!user?.is_admin || !selectedAircraft) return null;

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => setCurrentView('aircraft')}
              className="text-blue-600 hover:text-blue-800 mb-2"
            >
              ← Back to Aircraft Details
            </button>
            <h1 className="text-4xl font-bold text-gray-900">Edit Aircraft</h1>
            <p className="text-gray-600">{selectedAircraft.developer} {selectedAircraft.name}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <form onSubmit={handleAircraftSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Aircraft Name</label>
                <input
                  type="text"
                  value={aircraftFormData.name}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Developer (PMDG, Fenix, etc.)</label>
                <input
                  type="text"
                  value={aircraftFormData.developer}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, developer: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Aircraft Manufacturer (Boeing, Airbus, etc.)</label>
                <input
                  type="text"
                  value={aircraftFormData.aircraft_manufacturer}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, aircraft_manufacturer: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Boeing, Airbus, Cessna"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Aircraft Model</label>
                <input
                  type="text"
                  value={aircraftFormData.aircraft_model}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, aircraft_model: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., 737-800, A320, Citation CJ4"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Variant</label>
                <input
                  type="text"
                  value={aircraftFormData.variant}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, variant: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., A320neo, 737-800"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <div className="space-y-2">
                  <select
                    value={showCustomCategory ? 'custom' : aircraftFormData.category}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setShowCustomCategory(true);
                        setCustomCategory('');
                      } else {
                        setShowCustomCategory(false);
                        setAircraftFormData({...aircraftFormData, category: e.target.value});
                      }
                    }}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {allCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                    <option value="custom">➕ Add New Category</option>
                  </select>
                  
                  {showCustomCategory && (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Enter new category name..."
                        className="flex-1 border rounded-lg px-3 py-2"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customCategory.trim()) {
                            setAircraftFormData({...aircraftFormData, category: customCategory.trim()});
                            setAllCategories(prev => [...new Set([...prev, customCategory.trim()])]);
                            setShowCustomCategory(false);
                            setCustomCategory('');
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomCategory(false);
                          setCustomCategory('');
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  
                  {showCustomCategory && customCategory && (
                    <p className="text-sm text-blue-600">New category: "{customCategory}"</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price Type</label>
                <select
                  value={aircraftFormData.price_type}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, price_type: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="Paid">Paid</option>
                  <option value="Freeware">Freeware</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price</label>
                <input
                  type="text"
                  value={aircraftFormData.price}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, price: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., $59.99 or Free"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={aircraftFormData.description}
                onChange={(e) => setAircraftFormData({...aircraftFormData, description: e.target.value})}
                className="w-full border rounded-lg px-3 py-2 h-24"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Main Image URL</label>
                <input
                  type="url"
                  value={aircraftFormData.image_url}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, image_url: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cockpit Image URL</label>
                <input
                  type="url"
                  value={aircraftFormData.cockpit_image_url}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, cockpit_image_url: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Download URL</label>
                <input
                  type="url"
                  value={aircraftFormData.download_url}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, download_url: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Developer Website</label>
                <input
                  type="url"
                  value={aircraftFormData.developer_website}
                  onChange={(e) => setAircraftFormData({...aircraftFormData, developer_website: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Compatibility</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={aircraftFormData.compatibility.includes('MSFS 2020')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAircraftFormData({
                          ...aircraftFormData,
                          compatibility: [...aircraftFormData.compatibility.filter(c => c !== 'MSFS 2020'), 'MSFS 2020']
                        });
                      } else {
                        setAircraftFormData({
                          ...aircraftFormData,
                          compatibility: aircraftFormData.compatibility.filter(c => c !== 'MSFS 2020')
                        });
                      }
                    }}
                    className="mr-2"
                  />
                  <span>MSFS 2020</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={aircraftFormData.compatibility.includes('MSFS 2024')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAircraftFormData({
                          ...aircraftFormData,
                          compatibility: [...aircraftFormData.compatibility.filter(c => c !== 'MSFS 2024'), 'MSFS 2024']
                        });
                      } else {
                        setAircraftFormData({
                          ...aircraftFormData,
                          compatibility: aircraftFormData.compatibility.filter(c => c !== 'MSFS 2024')
                        });
                      }
                    }}
                    className="mr-2"
                  />
                  <span>MSFS 2024</span>
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-1">Select which Microsoft Flight Simulator versions this aircraft supports</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Features/Tags</label>
              <input
                type="text"
                value={aircraftFormData.features ? aircraftFormData.features.join(', ') : ''}
                onChange={(e) => setAircraftFormData({
                  ...aircraftFormData, 
                  features: e.target.value.split(',').map(f => f.trim()).filter(f => f)
                })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="e.g., Study Level, VNAV, Realistic Systems (separate with commas)"
              />
              <p className="text-sm text-gray-500 mt-1">Separate features with commas. These appear as tags on the aircraft.</p>
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Update Aircraft
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('aircraft')}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderTop10View = () => (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Top 10 Highest Rated Aircraft</h2>
        <p className="text-gray-600">Discover the best aircraft based on user reviews and ratings</p>
      </div>

      {topAircraft.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No rated aircraft available yet. Be the first to review!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {topAircraft.map((aircraft, index) => (
            <div
              key={aircraft.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer relative"
              onClick={() => openAircraftDetails(aircraft)}
            >
              {/* Ranking Badge */}
              <div className="absolute top-4 left-4 z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500' : 
                  index === 1 ? 'bg-gray-400' : 
                  index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                }`}>
                  {index + 1}
                </div>
              </div>

              <div className="aspect-video bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                <img
                  src={aircraft.image_url}
                  alt={aircraft.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML = `
                      <div class="text-white text-center">
                        <div class="text-4xl mb-2">✈️</div>
                        <div class="text-sm">${aircraft.variant}</div>
                      </div>
                    `;
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{aircraft.developer} {aircraft.name}</h3>
                    <p className="text-sm text-gray-500">{aircraft.variant}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    aircraft.price_type === 'Paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {aircraft.price_type}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{aircraft.description}</p>
                
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <span className="text-yellow-400 text-lg">{renderStars(aircraft.average_rating)}</span>
                    <span className="text-sm text-gray-600 ml-2">
                      {aircraft.average_rating} ({aircraft.total_reviews})
                    </span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">{aircraft.price}</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {aircraft.compatibility.map(compat => (
                    <span key={compat} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {compat}
                    </span>
                  ))}
                </div>

                {aircraft.features && aircraft.features.length > 0 && (
                  <div className="text-xs text-gray-500">
                    Features: {aircraft.features.slice(0, 2).join(', ')}
                    {aircraft.features.length > 2 && '...'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderViewAllPage = () => (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">All Aircraft</h1>
          <p className="text-gray-600 mt-2">Complete list of {allAircraft.length} aircraft available</p>
        </div>
        <div className="flex items-center space-x-4">
          <select 
            onChange={(e) => {
              const sorted = [...allAircraft];
              switch(e.target.value) {
                case 'name':
                  sorted.sort((a, b) => a.name.localeCompare(b.name));
                  break;
                case 'developer':
                  sorted.sort((a, b) => a.developer.localeCompare(b.developer));
                  break;
                case 'rating':
                  sorted.sort((a, b) => b.average_rating - a.average_rating);
                  break;
                case 'price':
                  sorted.sort((a, b) => {
                    const priceA = a.price === 'Free' ? 0 : parseFloat(a.price.replace('$', '')) || 0;
                    const priceB = b.price === 'Free' ? 0 : parseFloat(b.price.replace('$', '')) || 0;
                    return priceA - priceB;
                  });
                  break;
              }
              setAllAircraft(sorted);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="name">Sort by Name</option>
            <option value="developer">Sort by Developer</option>
            <option value="rating">Sort by Rating</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aircraft
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Developer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Views
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Compatibility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allAircraft.map((aircraft) => (
                <tr key={aircraft.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openAircraftDetails(aircraft)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-12 w-16">
                        <img
                          className="h-12 w-16 rounded object-cover"
                          src={aircraft.image_url}
                          alt={aircraft.name}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentNode.innerHTML = `
                              <div class="h-12 w-16 bg-blue-100 rounded flex items-center justify-center">
                                <span class="text-blue-600 text-lg">✈️</span>
                              </div>
                            `;
                          }}
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{aircraft.name}</div>
                        <div className="text-sm text-gray-500">{aircraft.variant}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{aircraft.developer}</div>
                    <div className="text-sm text-gray-500">{aircraft.aircraft_manufacturer}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {aircraft.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{aircraft.price}</div>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      aircraft.price_type === 'Paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {aircraft.price_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm text-yellow-400">{renderStars(aircraft.average_rating)}</div>
                      <div className="text-sm text-gray-500 ml-2">
                        {aircraft.average_rating} ({aircraft.total_reviews})
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{aircraft.view_count || 0}</div>
                    <div className="text-sm text-gray-500">views</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-1">
                      {aircraft.compatibility.map((comp) => (
                        <span key={comp} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAircraftDetails(aircraft);
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      View
                    </button>
                    {user?.is_admin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAircraft(aircraft);
                          setAircraftFormData({
                            name: aircraft.name,
                            developer: aircraft.developer,
                            aircraft_manufacturer: aircraft.aircraft_manufacturer,
                            aircraft_model: aircraft.aircraft_model,
                            variant: aircraft.variant,
                            category: aircraft.category,
                            price_type: aircraft.price_type,
                            price: aircraft.price || '',
                            description: aircraft.description,
                            image_url: aircraft.image_url || '',
                            cockpit_image_url: aircraft.cockpit_image_url || '',
                            additional_images: aircraft.additional_images || [],
                            release_date: aircraft.release_date || '',
                            compatibility: aircraft.compatibility || ['MS2024'],
                            download_url: aircraft.download_url || '',
                            developer_website: aircraft.developer_website || '',
                            features: aircraft.features || []
                          });
                          setCurrentView('edit');
                        }}
                        className="text-orange-600 hover:text-orange-900"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {allAircraft.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">✈️</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No aircraft found</h3>
          <p className="text-gray-500">There are no aircraft available at the moment.</p>
        </div>
      )}
    </div>
  );

  const renderBrowseAllView = () => (
    <div className="bg-gray-50 min-h-screen">
      <div className="flex">
        {/* Left Filter Sidebar */}
        <div className="w-80 bg-white shadow-lg">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <button
              onClick={() => setFilters({
                priceRange: [0, 200],
                selectedDevelopers: [],
                selectedManufacturers: [],
                selectedCategories: [],
                selectedRatings: [],
                selectedCompatibility: [],
                priceType: [],
                searchText: ''
              })}
              className="text-sm text-blue-600 hover:text-blue-800 mt-2"
            >
              Clear All
            </button>
          </div>
          
          <div className="p-6 space-y-6 max-h-screen overflow-y-auto">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={filters.searchText}
                onChange={(e) => updateFilter('searchText', e.target.value)}
                placeholder="Search aircraft..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filters.priceRange[0]}
                  onChange={(e) => updateFilter('priceRange', [parseInt(e.target.value), filters.priceRange[1]])}
                  className="w-full"
                />
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filters.priceRange[1]}
                  onChange={(e) => updateFilter('priceRange', [filters.priceRange[0], parseInt(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>

            {/* Price Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price Type</label>
              <div className="space-y-2">
                {['Paid', 'Freeware'].map(type => (
                  <label key={type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.priceType.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('priceType', [...filters.priceType, type]);
                        } else {
                          updateFilter('priceType', filters.priceType.filter(t => t !== type));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Developers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Developers</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {developers.map(dev => (
                  <label key={dev} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.selectedDevelopers.includes(dev)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('selectedDevelopers', [...filters.selectedDevelopers, dev]);
                        } else {
                          updateFilter('selectedDevelopers', filters.selectedDevelopers.filter(d => d !== dev));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{dev}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Manufacturers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Aircraft Manufacturers</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {allManufacturers.map(manufacturer => (
                  <label key={manufacturer} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.selectedManufacturers.includes(manufacturer)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('selectedManufacturers', [...filters.selectedManufacturers, manufacturer]);
                        } else {
                          updateFilter('selectedManufacturers', filters.selectedManufacturers.filter(m => m !== manufacturer));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{manufacturer}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
              <div className="space-y-2">
                {allCategories.map(category => (
                  <label key={category} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.selectedCategories.includes(category)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('selectedCategories', [...filters.selectedCategories, category]);
                        } else {
                          updateFilter('selectedCategories', filters.selectedCategories.filter(c => c !== category));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Rating Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map(rating => (
                  <label key={rating} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.selectedRatings.includes(rating)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('selectedRatings', [...filters.selectedRatings, rating]);
                        } else {
                          updateFilter('selectedRatings', filters.selectedRatings.filter(r => r !== rating));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{rating}+ Stars</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Compatibility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Compatibility</label>
              <div className="space-y-2">
                {[
                  { display: 'MSFS 2024', value: 'MS2024' },
                  { display: 'MSFS 2020', value: 'MS2020' }
                ].map(compat => (
                  <label key={compat.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.selectedCompatibility.includes(compat.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('selectedCompatibility', [...filters.selectedCompatibility, compat.value]);
                        } else {
                          updateFilter('selectedCompatibility', filters.selectedCompatibility.filter(c => c !== compat.value));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{compat.display}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Browse All Aircraft</h1>
                <p className="text-gray-600 mt-2">
                  Showing <span className="font-semibold text-blue-600">{getSortedAircraft().length}</span> of {allAircraft.length} aircraft
                  {sortConfig.key && (
                    <span className="text-sm text-gray-500 ml-2">
                      • Sorted by {sortConfig.key.replace('_', ' ')} {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                    </span>
                  )}
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* View Mode Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('detailed')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === 'detailed'
                        ? 'bg-white text-gray-900 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Detailed
                  </button>
                  <button
                    onClick={() => setViewMode('compact')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === 'compact'
                        ? 'bg-white text-gray-900 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Compact
                  </button>
                </div>
                
                {/* Clear all filters button */}
                {(filters.selectedDevelopers.length > 0 || filters.selectedManufacturers.length > 0 || 
                  filters.selectedCategories.length > 0 || filters.selectedCompatibility.length > 0 || 
                  filters.priceType.length > 0 || filters.selectedRatings.length > 0 || 
                  filters.searchText || filters.priceRange[0] > 0 || filters.priceRange[1] < 200) && (
                  <button
                    onClick={() => setFilters({
                      priceRange: [0, 200],
                      selectedDevelopers: [],
                      selectedManufacturers: [],
                      selectedCategories: [],
                      selectedRatings: [],
                      selectedCompatibility: [],
                      priceType: [],
                      searchText: ''
                    })}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
            
            {/* Active Filters */}
            {(filters.selectedDevelopers.length > 0 || filters.selectedManufacturers.length > 0 || 
              filters.selectedCategories.length > 0 || filters.selectedCompatibility.length > 0 || 
              filters.priceType.length > 0 || filters.selectedRatings.length > 0 || 
              filters.searchText) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {filters.searchText && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center">
                    Search: "{filters.searchText}"
                    <button
                      onClick={() => updateFilter('searchText', '')}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >×</button>
                  </span>
                )}
                {filters.selectedDevelopers.map(dev => (
                  <span key={dev} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center">
                    {dev}
                    <button
                      onClick={() => updateFilter('selectedDevelopers', filters.selectedDevelopers.filter(d => d !== dev))}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >×</button>
                  </span>
                ))}
                {filters.selectedManufacturers.map(man => (
                  <span key={man} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center">
                    {man}
                    <button
                      onClick={() => updateFilter('selectedManufacturers', filters.selectedManufacturers.filter(m => m !== man))}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >×</button>
                  </span>
                ))}
                {filters.selectedCategories.map(cat => (
                  <span key={cat} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm flex items-center">
                    {cat}
                    <button
                      onClick={() => updateFilter('selectedCategories', filters.selectedCategories.filter(c => c !== cat))}
                      className="ml-2 text-orange-600 hover:text-orange-800"
                    >×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Aircraft Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* Aircraft Column (Always first) */}
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('name')}
                  >
                    Aircraft{getSortIcon('name')}
                  </th>
                  
                  {/* Detailed View Columns */}
                  {viewMode === 'detailed' && (
                    <>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('developer')}
                      >
                        Developer{getSortIcon('developer')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('aircraft_manufacturer')}
                      >
                        Manufacturer{getSortIcon('aircraft_manufacturer')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('aircraft_model')}
                      >
                        Aircraft Model{getSortIcon('aircraft_model')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('variant')}
                      >
                        Variant{getSortIcon('variant')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('category')}
                      >
                        Category{getSortIcon('category')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('price_type')}
                      >
                        Price Type{getSortIcon('price_type')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('price')}
                      >
                        Price{getSortIcon('price')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Compatibility
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('average_rating')}
                      >
                        Rating{getSortIcon('average_rating')}
                      </th>
                    </>
                  )}
                  
                  {/* Compact View Columns */}
                  {viewMode === 'compact' && (
                    <>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('aircraft_manufacturer')}
                      >
                        Manufacturer{getSortIcon('aircraft_manufacturer')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('developer')}
                      >
                        Developer{getSortIcon('developer')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('category')}
                      >
                        Category{getSortIcon('category')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('price')}
                      >
                        Price{getSortIcon('price')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Compatibility
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('average_rating')}
                      >
                        Rating{getSortIcon('average_rating')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('view_count')}
                      >
                        Views{getSortIcon('view_count')}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getSortedAircraft().map((aircraft) => (
                  <tr
                    key={aircraft.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => openAircraftDetails(aircraft)}
                  >
                    {/* Aircraft Column (Always first) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={aircraft.image_url}
                          alt={aircraft.name}
                          className="h-12 w-16 object-cover rounded mr-4"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{aircraft.name}</div>
                          {viewMode === 'compact' && (
                            <div className="text-sm text-gray-500">{aircraft.aircraft_model}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Detailed View Columns */}
                    {viewMode === 'detailed' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {aircraft.developer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {aircraft.aircraft_manufacturer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {aircraft.aircraft_model}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {aircraft.variant}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {aircraft.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            aircraft.price_type === 'Paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {aircraft.price_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                          {aircraft.price}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-1">
                            {aircraft.compatibility && aircraft.compatibility.map((comp) => (
                              <span key={comp} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                {comp === 'MS2024' ? 'MSFS 2024' : comp === 'MS2020' ? 'MSFS 2020' : comp}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm text-yellow-400">{renderStars(aircraft.average_rating)}</div>
                            <div className="text-sm text-gray-500 ml-2">
                              {aircraft.average_rating > 0 ? aircraft.average_rating.toFixed(1) : 'No rating'}
                            </div>
                          </div>
                        </td>
                      </>
                    )}
                    
                    {/* Compact View Columns */}
                    {viewMode === 'compact' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {aircraft.aircraft_manufacturer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {aircraft.developer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {aircraft.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{aircraft.price}</div>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            aircraft.price_type === 'Paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {aircraft.price_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-1">
                            {aircraft.compatibility && aircraft.compatibility.map((comp) => (
                              <span key={comp} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                {comp === 'MS2024' ? 'MSFS 2024' : comp === 'MS2020' ? 'MSFS 2020' : comp}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm text-yellow-400">{renderStars(aircraft.average_rating)}</div>
                            <div className="text-sm text-gray-500 ml-2">
                              {aircraft.average_rating > 0 ? aircraft.average_rating.toFixed(1) : 'No rating'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {aircraft.view_count || 0}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {getSortedAircraft().length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No aircraft match your filters</h3>
                <p className="text-gray-500">Try adjusting your filter criteria to see more results.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMostViewedPage = () => (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">👀 Most Viewed Aircraft</h2>
        <p className="text-gray-600">Discover the aircraft that capture the community's attention</p>
        <div className="mt-4 text-sm text-gray-500">
          Total page views across all aircraft: {analytics.total_views.toLocaleString()}
        </div>
      </div>

      {analytics.most_viewed.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No view data available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {analytics.most_viewed.map((aircraft, index) => (
            <div
              key={aircraft.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer relative"
              onClick={() => openAircraftDetails(aircraft)}
            >
              {/* View Count Badge */}
              <div className="absolute top-4 right-4 z-10">
                <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                  👀 {aircraft.view_count || 0}
                </div>
              </div>

              {/* Ranking Badge */}
              <div className="absolute top-4 left-4 z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500' : 
                  index === 1 ? 'bg-gray-400' : 
                  index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                }`}>
                  {index + 1}
                </div>
              </div>

              <div className="aspect-video bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                <img
                  src={aircraft.image_url}
                  alt={aircraft.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML = `
                      <div class="text-white text-center">
                        <div class="text-4xl mb-2">✈️</div>
                        <div class="text-sm">${aircraft.variant}</div>
                      </div>
                    `;
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{aircraft.developer} {aircraft.name}</h3>
                    <p className="text-sm text-gray-500">{aircraft.variant}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    aircraft.price_type === 'Paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {aircraft.price_type}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <span className="text-yellow-400 text-lg">{renderStars(aircraft.average_rating)}</span>
                    <span className="text-sm text-gray-600 ml-2">
                      {aircraft.average_rating} ({aircraft.total_reviews})
                    </span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">{aircraft.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTrendingPage = () => (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">🔥 Trending Aircraft</h2>
        <p className="text-gray-600">Currently popular aircraft (viewed in the last 7 days)</p>
      </div>

      {analytics.trending.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No trending aircraft this week.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {analytics.trending.map((aircraft, index) => (
            <div
              key={aircraft.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer relative"
              onClick={() => openAircraftDetails(aircraft)}
            >
              {/* Trending Badge */}
              <div className="absolute top-4 right-4 z-10">
                <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                  🔥 Hot
                </div>
              </div>

              {/* View Count */}
              <div className="absolute top-4 left-4 z-10">
                <div className="bg-blue-500/80 text-white px-2 py-1 rounded text-sm">
                  👀 {aircraft.view_count || 0}
                </div>
              </div>

              <div className="aspect-video bg-gradient-to-br from-red-600 to-orange-800 flex items-center justify-center">
                <img
                  src={aircraft.image_url}
                  alt={aircraft.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML = `
                      <div class="text-white text-center">
                        <div class="text-4xl mb-2">✈️</div>
                        <div class="text-sm">${aircraft.variant}</div>
                      </div>
                    `;
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{aircraft.developer} {aircraft.name}</h3>
                    <p className="text-sm text-gray-500">{aircraft.variant}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    aircraft.price_type === 'Paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {aircraft.price_type}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <span className="text-yellow-400 text-lg">{renderStars(aircraft.average_rating)}</span>
                    <span className="text-sm text-gray-600 ml-2">
                      {aircraft.average_rating} ({aircraft.total_reviews})
                    </span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">{aircraft.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAdminDashboard = () => {
    if (!user?.is_admin) return null;

    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">FlightSimSpot administration and statistics</p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Registered Users</h3>
                <p className="text-3xl font-bold text-blue-600">{adminStats.total_users}</p>
                <p className="text-sm text-gray-500">+{adminStats.recent_users_7_days} this week</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <span className="text-2xl">✈️</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Total Aircraft</h3>
                <p className="text-3xl font-bold text-green-600">{adminStats.total_aircraft}</p>
                <p className="text-sm text-gray-500">{adminStats.archived_aircraft} archived</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <span className="text-2xl">⭐</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Total Reviews</h3>
                <p className="text-3xl font-bold text-yellow-600">{adminStats.total_reviews}</p>
                <p className="text-sm text-gray-500">+{adminStats.recent_reviews_7_days} this week</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-4">
              <button
                onClick={() => openAddAircraftForm()}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                ➕ Add New Aircraft
              </button>
              <button
                onClick={() => setCurrentView('viewall')}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                📋 Manage All Aircraft
              </button>
              <button
                onClick={() => setShowWelcomeEditor(true)}
                className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                ✏️ Edit Welcome Message
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">New users this week</span>
                <span className="font-semibold text-green-600">+{adminStats.recent_users_7_days}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">New reviews this week</span>
                <span className="font-semibold text-blue-600">+{adminStats.recent_reviews_7_days}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Total page views</span>
                <span className="font-semibold text-purple-600">{analytics.total_views}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-gray-50">
        {renderNavigation()}

        {currentView === 'categories' && renderCategoriesView()}
        {currentView === 'manufacturers' && renderManufacturersView()}
        {currentView === 'simulations' && renderSimulationsView()}
        {currentView === 'aircraft' && renderAircraftDetailView()}
        {currentView === 'edit' && renderEditAircraftView()}
        {currentView === 'top10' && renderTop10View()}
        {currentView === 'viewall' && renderViewAllPage()}
        {currentView === 'browse' && renderBrowseAllView()}
        {currentView === 'mostviewed' && renderMostViewedPage()}
        {currentView === 'trending' && renderTrendingPage()}
        {currentView === 'admin' && renderAdminDashboard()}

        {/* Welcome Message Editor Modal */}
        {showWelcomeEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">Edit Welcome Message</h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const message = formData.get('message');
                  
                  if (await updateWelcomeMessage(message)) {
                    setShowWelcomeEditor(false);
                    alert('Welcome message updated successfully!');
                  } else {
                    alert('Error updating welcome message. Please try again.');
                  }
                }}>
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">Welcome Message</label>
                    <textarea
                      name="message"
                      className="w-full border rounded-lg px-3 py-2 h-40"
                      defaultValue={welcomeMessage || "Welcome to FlightSimSpot! Your ultimate destination for Microsoft Flight Simulator aircraft reviews. Discover the best aircraft from our community of flight simulation enthusiasts."}
                      placeholder="Enter your welcome message..."
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">This message will be displayed on the homepage.</p>
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Update Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWelcomeEditor(false)}
                      className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Login Prompt Modal */}
        {showLoginPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">Login Required</h2>
              <p className="text-gray-600 mb-4">
                Please login with Google to write a review.
              </p>
              <div className="flex justify-center mb-4">
                <GoogleLogin
                  onSuccess={handleGoogleLogin}
                  onError={() => console.log('Login Failed')}
                  theme="outline"
                  size="large"
                />
              </div>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="w-full py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Aircraft Form Modal (Add/Edit) */}
        {(showAircraftForm || showEditForm) && user?.is_admin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-screen overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold">
                  {showEditForm ? 'Edit Aircraft' : 'Add New Aircraft'}
                </h2>
                <button
                  onClick={() => {
                    setShowAircraftForm(false);
                    setShowEditForm(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleAircraftSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Aircraft Name</label>
                    <input
                      type="text"
                      value={aircraftFormData.name}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, name: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Developer (PMDG, Fenix, etc.)</label>
                    <input
                      type="text"
                      value={aircraftFormData.developer}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, developer: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Aircraft Manufacturer (Boeing, Airbus, etc.)</label>
                    <input
                      type="text"
                      value={aircraftFormData.aircraft_manufacturer}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, aircraft_manufacturer: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., Boeing, Airbus, Cessna"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Aircraft Model</label>
                    <input
                      type="text"
                      value={aircraftFormData.aircraft_model}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, aircraft_model: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., 737-800, A320, Citation CJ4"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Variant</label>
                    <input
                      type="text"
                      value={aircraftFormData.variant}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, variant: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., A320neo, 737-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <div className="space-y-2">
                      <select
                        value={showCustomCategory ? 'custom' : aircraftFormData.category}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setShowCustomCategory(true);
                            setCustomCategory('');
                          } else {
                            setShowCustomCategory(false);
                            setAircraftFormData({...aircraftFormData, category: e.target.value});
                          }
                        }}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        {allCategories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                        <option value="custom">➕ Add New Category</option>
                      </select>
                      
                      {showCustomCategory && (
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            placeholder="Enter new category name..."
                            className="flex-1 border rounded-lg px-3 py-2"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (customCategory.trim()) {
                                setAircraftFormData({...aircraftFormData, category: customCategory.trim()});
                                setAllCategories(prev => [...new Set([...prev, customCategory.trim()])]);
                                setShowCustomCategory(false);
                                setCustomCategory('');
                              }
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomCategory(false);
                              setCustomCategory('');
                            }}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      
                      {showCustomCategory && customCategory && (
                        <p className="text-sm text-blue-600">New category: "{customCategory}"</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Price Type</label>
                    <select
                      value={aircraftFormData.price_type}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, price_type: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Freeware">Freeware</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Price</label>
                    <input
                      type="text"
                      value={aircraftFormData.price}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, price: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., $59.99 or Free"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={aircraftFormData.description}
                    onChange={(e) => setAircraftFormData({...aircraftFormData, description: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 h-24"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Image URL</label>
                    <input
                      type="url"
                      value={aircraftFormData.image_url}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, image_url: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cockpit Image URL</label>
                    <input
                      type="url"
                      value={aircraftFormData.cockpit_image_url}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, cockpit_image_url: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Download URL</label>
                    <input
                      type="url"
                      value={aircraftFormData.download_url}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, download_url: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Developer Website</label>
                    <input
                      type="url"
                      value={aircraftFormData.developer_website}
                      onChange={(e) => setAircraftFormData({...aircraftFormData, developer_website: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Features/Tags</label>
                  <input
                    type="text"
                    value={aircraftFormData.features ? aircraftFormData.features.join(', ') : ''}
                    onChange={(e) => setAircraftFormData({
                      ...aircraftFormData, 
                      features: e.target.value.split(',').map(f => f.trim()).filter(f => f)
                    })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., Study Level, VNAV, Realistic Systems (separate with commas)"
                  />
                  <p className="text-sm text-gray-500 mt-1">Separate features with commas. These appear as tags on the aircraft.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Compatibility</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={aircraftFormData.compatibility.includes('MSFS 2020')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAircraftFormData({
                              ...aircraftFormData,
                              compatibility: [...aircraftFormData.compatibility.filter(c => c !== 'MSFS 2020'), 'MSFS 2020']
                            });
                          } else {
                            setAircraftFormData({
                              ...aircraftFormData,
                              compatibility: aircraftFormData.compatibility.filter(c => c !== 'MSFS 2020')
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span>MSFS 2020</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={aircraftFormData.compatibility.includes('MSFS 2024')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAircraftFormData({
                              ...aircraftFormData,
                              compatibility: [...aircraftFormData.compatibility.filter(c => c !== 'MSFS 2024'), 'MSFS 2024']
                            });
                          } else {
                            setAircraftFormData({
                              ...aircraftFormData,
                              compatibility: aircraftFormData.compatibility.filter(c => c !== 'MSFS 2024')
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span>MSFS 2024</span>
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Select which Microsoft Flight Simulator versions this aircraft supports</p>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    {showEditForm ? 'Update Aircraft' : 'Add Aircraft'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAircraftForm(false);
                      setShowEditForm(false);
                    }}
                    className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </GoogleOAuthProvider>
  );

}

export default App;