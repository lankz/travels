function travelApp() {
    return {
        map: null,
        markers: [],
        routes: [],
        selectedTrip: null,
        selectedPhoto: null,
        currentPhotoIndex: 0,
        activeTab: 'timeline',

        // Data will be injected from HTML
        allPhotos: window.travelMapData?.photos || [],
        allTrips: window.travelMapData?.trips || [],
        
        init: function() {
            this.initMap();
            this.loadAllPhotos();
            this.initKeyboardNavigation();
        },
        
        initKeyboardNavigation: function() {
            var self = this;
            document.addEventListener('keydown', function(e) {
                if (self.selectedPhoto) {
                    switch(e.key) {
                        case 'Escape':
                            self.closePhotoViewer();
                            break;
                        case 'ArrowLeft':
                            self.previousPhoto();
                            break;
                        case 'ArrowRight':
                            self.nextPhoto();
                            break;
                    }
                }
            });
        },
        
        initMap: function() {
            // Initialize Leaflet map
            this.map = L.map('map').setView([-33.8688, 151.2093], 2);
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
        },
        
        loadAllPhotos: function() {
            var self = this;
            this.clearMarkers();
            this.clearRoutes();
            
            this.allPhotos.forEach(function(photo) {
                var lat = photo.latitude;
                var lng = photo.longitude;
                
                // If photo doesn't have coordinates, use segment coordinates
                if (!lat || !lng) {
                    var segment = self.getSegmentForPhoto(photo);
                    if (segment && segment.location) {
                        var coords = segment.location.split(',');
                        if (coords.length >= 2) {
                            lat = parseFloat(coords[0].trim());
                            lng = parseFloat(coords[1].trim());
                        }
                    }
                }
                
                if (lat && lng) {
                    self.addPhotoMarker(photo, lat, lng);
                }
            });
            
            this.fitMapToContent();
        },
        
        selectTrip: function(tripId) {
            // Toggle trip selection
            if (String(this.selectedTrip) === String(tripId)) {
                this.selectedTrip = null;
                this.loadAllPhotos();
            } else {
                this.selectedTrip = tripId;
                this.activeTab = 'timeline'; // Reset to timeline tab
                this.clearMarkers();
                this.clearRoutes();
                
                // Load photos for selected trip
                var self = this;
                var tripPhotos = this.allPhotos.filter(function(photo) {
                    return String(photo.trip_id) === String(tripId);
                });
                
                tripPhotos.forEach(function(photo) {
                    var lat = photo.latitude;
                    var lng = photo.longitude;
                    
                    // If photo doesn't have coordinates, use segment coordinates
                    if (!lat || !lng) {
                        var segment = self.getSegmentForPhoto(photo);
                        if (segment && segment.location) {
                            var coords = segment.location.split(',');
                            if (coords.length >= 2) {
                                lat = parseFloat(coords[0].trim());
                                lng = parseFloat(coords[1].trim());
                            }
                        }
                    }
                    
                    if (lat && lng) {
                        self.addPhotoMarker(photo, lat, lng);
                    }
                });
                
                // Load routes for selected trip
                var selectedTrip = this.allTrips.find(function(trip) {
                    return String(trip.id) === String(tripId);
                });
                
                if (selectedTrip && selectedTrip.segments) {
                    selectedTrip.segments.forEach(function(segment) {
                        self.loadRouteForSegment(segment);
                    });
                }
                

                this.fitMapToContent();
            }
        },
        

        
        addPhotoMarker: function(photo, lat, lng) {
            // Use provided coordinates or fallback to photo coordinates
            var latitude = lat || photo.latitude;
            var longitude = lng || photo.longitude;
            
            if (!latitude || !longitude) return;
            
            // Create custom icon with photo thumbnail
            var icon = L.divIcon({
                className: 'photo-marker',
                html: '<img src="' + window.travelMapData.baseurl + '/assets/photos/thumbs/' + photo.filename + '" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });
            
            var self = this;
            var popupContent = '<div class="photo-popup max-w-sm cursor-pointer" style="min-width: 280px;">' +
                '<div class="relative overflow-hidden rounded-lg mb-3">' +
                    '<img src="' + window.travelMapData.baseurl + '/assets/photos/medium/' + photo.filename + '" ' +
                         'class="w-full h-48 object-cover hover:scale-105 transition-transform duration-200" ' +
                         'alt="' + photo.original_name + '">' +
                    '<div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">' +
                        '<i class="fas fa-expand text-white opacity-0 hover:opacity-100 transition-opacity duration-200"></i>' +
                    '</div>' +
                '</div>' +
                '<div class="space-y-2">' +
                    '<h4 class="font-semibold text-gray-900 leading-tight">' + photo.original_name + '</h4>' +
                    '<div class="flex items-center text-sm text-gray-600">' +
                        '<i class="fas fa-calendar-alt mr-2 text-gray-400"></i>' +
                        '<span>' + (photo.date_taken || 'Date unknown') + '</span>' +
                    '</div>';
            
            if (photo.camera_make) {
                popupContent += '<div class="flex items-center text-xs text-gray-500">' +
                    '<i class="fas fa-camera mr-2 text-gray-400"></i>' +
                    '<span>' + photo.camera_make + ' ' + (photo.camera_model || '') + '</span>' +
                '</div>';
            }
            
            popupContent += '<div class="pt-2 border-t border-gray-100 text-xs text-gray-400">' +
                '<i class="fas fa-mouse-pointer mr-1"></i>' +
                'Click to view full size' +
            '</div>' +
            '</div>' +
            '</div>';
            
            var marker = L.marker([latitude, longitude], { icon: icon })
                .bindPopup(popupContent)
                .addTo(this.map);
            
            // Add click handler to popup to open photo viewer
            marker.on('popupopen', function() {
                var popup = marker.getPopup();
                var popupElement = popup.getElement();
                if (popupElement) {
                    var photoPopup = popupElement.querySelector('.photo-popup');
                    if (photoPopup) {
                        photoPopup.addEventListener('click', function() {
                            self.focusOnPhoto(photo);
                            marker.closePopup();
                        });
                    }
                }
            });
            
            this.markers.push(marker);
        },
        
        clearMarkers: function() {
            var self = this;
            this.markers.forEach(function(marker) {
                self.map.removeLayer(marker);
            });
            this.markers = [];
        },
        
        clearRoutes: function() {
            var self = this;
            this.routes.forEach(function(route) {
                self.map.removeLayer(route);
            });
            this.routes = [];
        },
        
        loadRouteForSegment: function(segment) {
            console.log('Loading route for segment:', segment.title, 'Type:', segment.type, 'GeoJSON:', segment.geojson_filename);
            
            // Only load routes for drive, ferry, and flight segments
            if (!segment.geojson_filename || !['drive', 'ferry', 'flight'].includes(segment.type)) {
                console.log('Skipping route load - no geojson or wrong type');
                return;
            }
            
            var self = this;
            var geojsonUrl = window.travelMapData.baseurl + '/assets/geojson/' + segment.geojson_filename;
            console.log('Fetching route from:', geojsonUrl);
            
            fetch(geojsonUrl)
                .then(function(response) {
                    console.log('Route fetch response:', response.status);
                    if (!response.ok) {
                        throw new Error('Failed to load route: ' + response.statusText);
                    }
                    return response.json();
                })
                .then(function(geojsonData) {
                    console.log('Route data loaded successfully, features:', geojsonData.features ? geojsonData.features.length : 0);
                    
                    // Style the route based on segment type
                    var routeStyle = {
                        color: self.getRouteColor(segment.type),
                        weight: 3,
                        opacity: 0.8,
                        dashArray: segment.type === 'flight' ? '10, 10' : null
                    };
                    
                    var routeLayer = L.geoJSON(geojsonData, {
                        style: routeStyle,
                        onEachFeature: function(feature, layer) {
                            layer.bindPopup('<h4 class="font-medium">' + segment.title + '</h4>' +
                                          '<p class="text-sm text-gray-600 capitalize">' + segment.type + '</p>');
                        }
                    }).addTo(self.map);
                    
                    self.routes.push(routeLayer);
                    console.log('Route added to map, total routes:', self.routes.length);
                    
                    // Refit map to include the new route
                    self.fitMapToContent();
                })
                .catch(function(error) {
                    console.error('Could not load route for segment:', segment.title, error);
                });
        },
        
        getRouteColor: function(segmentType) {
            switch(segmentType) {
                case 'drive': return '#3B82F6';  // Blue
                case 'ferry': return '#06B6D4';  // Cyan
                case 'flight': return '#EF4444'; // Red
                default: return '#6B7280';       // Gray
            }
        },
        
        fitMapToContent: function() {
            var allLayers = [];
            
            // Add photo markers
            allLayers = allLayers.concat(this.markers);
            
            // Add route layers
            allLayers = allLayers.concat(this.routes);
            
            if (allLayers.length > 0) {
                var group = new L.featureGroup(allLayers);
                this.map.fitBounds(group.getBounds(), { padding: [20, 20] });
            }
        },
        
        focusOnPhoto: function(photo) {
            this.selectedPhoto = photo;
            this.currentPhotoIndex = this.getVisiblePhotos().findIndex(function(p) {
                return p.id === photo.id;
            });
        },
        
        closePhotoViewer: function() {
            this.selectedPhoto = null;
            this.currentPhotoIndex = 0;
        },
        
        nextPhoto: function() {
            var visiblePhotos = this.getVisiblePhotos();
            if (this.currentPhotoIndex < visiblePhotos.length - 1) {
                this.currentPhotoIndex++;
                this.selectedPhoto = visiblePhotos[this.currentPhotoIndex];
            }
        },
        
        previousPhoto: function() {
            var visiblePhotos = this.getVisiblePhotos();
            if (this.currentPhotoIndex > 0) {
                this.currentPhotoIndex--;
                this.selectedPhoto = visiblePhotos[this.currentPhotoIndex];
            }
        },
        
        canNavigatePhotos: function() {
            return this.getVisiblePhotos().length > 1;
        },
        
        getVisiblePhotos: function() {
            if (this.selectedTrip) {
                return this.allPhotos.filter(function(photo) {
                    return String(photo.trip_id) === String(this.selectedTrip);
                }.bind(this));
            }
            return this.allPhotos;
        },
        

        
        formatFileSize: function(bytes) {
            if (!bytes) return 'Unknown';
            var sizes = ['Bytes', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        },
        
        getTripName: function(tripId) {
            var trip = this.allTrips.find(function(t) {
                return String(t.id) === String(tripId);
            });
            return trip ? trip.name : '';
        },
        
        getSegmentForPhoto: function(photo) {
            if (!photo.segment_id) return null;
            
            for (var i = 0; i < this.allTrips.length; i++) {
                var trip = this.allTrips[i];
                if (trip.segments) {
                    for (var j = 0; j < trip.segments.length; j++) {
                        var segment = trip.segments[j];
                        if (String(segment.id) === String(photo.segment_id)) {
                            return segment;
                        }
                    }
                }
            }
            return null;
        },
        
        getPhotoLatitude: function(photo) {
            if (!photo) return '';
            if (photo.latitude) return photo.latitude;
            
            var segment = this.getSegmentForPhoto(photo);
            if (segment && segment.location) {
                var coords = segment.location.split(',');
                if (coords.length >= 2) {
                    return parseFloat(coords[0].trim());
                }
            }
            return '';
        },
        
        getPhotoLongitude: function(photo) {
            if (!photo) return '';
            if (photo.longitude) return photo.longitude;
            
            var segment = this.getSegmentForPhoto(photo);
            if (segment && segment.location) {
                var coords = segment.location.split(',');
                if (coords.length >= 2) {
                    return parseFloat(coords[1].trim());
                }
            }
            return '';
        }
    };
} 