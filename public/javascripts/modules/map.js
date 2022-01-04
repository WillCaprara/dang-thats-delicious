import axios from 'axios';
import { $ } from './bling';

//More info about additional options in the docs for google maps.
const mapOptions = {
    center: { lat: 43.2, lng: -79.8 },
    zoom: 10
};

function loadPlaces(map, lat = 43.2, lng= -79.8) {
    axios.get(`/api/stores/near?lat=${lat}&lng=${lng}`)
        .then(res => {
            const places = res.data;
            if(!places) {
                //For simplicity, we will just show an alert, but here you can show a nicer message to the user in the page that there are no places to show.
                alert('No places found!');
                return;
            }
            //Bounds -> Will detect where all of the markers are, let's just zoom in so that all of the markers fit but we are zoomed in as far as we can possibly go.
            //Create a bounds
            const bounds = new google.maps.LatLngBounds();
            //When you have a pop up in google maps, its called an info window.
            //We don't need to pass any parameters here to InfoWindow because the data will be coming once we actually want to click on them.
            const infoWindow = new google.maps.InfoWindow();

            //Make a whole bunch of markers (pins that will appear on the map).
            //Take our places array, map over each of them and return a marker for each place.
            const markers = places.map(place => {
                //We are doing lng lat because the data that comes back from our database is lng lat.
                //We are using array destructuring to assign the values.
                const [placeLng, placeLat] = place.location.coordinates;
                //Make position object for google maps.
                const position = { lat: placeLat, lng: placeLng };
                //We are going to extend our bounds so that it will fit each of the markers.
                bounds.extend(position);
                const marker = new google.maps.Marker({ map, position });
                //Attach the place data to that marker, because when someone clicks the marker we need something to reference that place data.
                marker.place = place;
                return marker;
            });
            //Loop over each of the markers, and attach an event listener so that when somebody clicks on one of the markers we can actuall show that info window.
            //.addListener is the google maps equivalent of addEventListener.
            markers.forEach(marker => marker.addListener('click', function() {
                const html = `
                    <div class="popup">
                        <a href="/store/${this.place.slug}">
                            <img src="/uploads/${this.place.photo || 'store.png'}" alt="${this.place.name}">
                            <p>${this.place.name} - ${this.place.location.address}</p>
                        </a>
                    </div>
                `;
                infoWindow.setContent(html);
                infoWindow.open({
                    anchor: marker,
                    map,
                    shouldFocus: false
                });
            }));            
            //Then zoom the map to fit all of our markers perfectly.
            map.setCenter(bounds.getCenter());
            map.fitBounds(bounds);
        });
};

function makeMap(mapDiv) {
    if(!mapDiv) return;
    //make map
    //.Map()-> You pass it 2 things: 1. Where it should go (a div), 2. Map Options (theconst we created above).
    //When the page loads, it will create a map, and when the map is done being created, we will load the places.
    const map = new google.maps.Map(mapDiv, mapOptions);
    //Once we actually have our map, we are going to run load places and we are going to pass it our map.
    loadPlaces(map);

    const input = $('[name="geolocate"]');
    const autocomplete = new google.maps.places.Autocomplete(input);
    //Try and load places for the lat and lng the person typed in the textbox
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        loadPlaces(map, place.geometry.location.lat(), place.geometry.location.lng());
    });
};

export default makeMap;