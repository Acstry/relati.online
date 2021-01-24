
// paste key here: please do NOT commit the API key
const PUBLISH_KEY = "";

let prevWait = Promise.resolve();
let requestCount = 0;

Radar.initialize(PUBLISH_KEY);

let mymap = L.map('mapid');

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
  attribution: '',
  maxZoom: 18,
  id: 'mapbox/streets-v11',
  accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'
}).addTo(mymap);

const INTERESTS = {
    OUTDOOR: 'outdoor-places',
    SCHOOLS: 'education',
    SHOPPING: 'shopping-retail',
    INFRASTRUCTURE: 'city-infrastructure',
    ARTS_ENTERTAINMENT: 'arts-entertainment',
    RELIGION: 'religion',
};

//window.onload = () => findMyRoute();

function findSpecifiedRoute(){
    console.log('here');
    let streetAddress = document.getElementById('streetAddress').value;
    let cityAndState = document.getElementById('cityAndState').value;
    //let duration = document.getElementById('durationSelect').value;
    let durationRadio = document.getElementsByName('duration');
    console.log(durationRadio);
    let duration = Array.from(durationRadio).filter(dur => dur.checked)[0].value;
    console.log(streetAddress, cityAndState, duration);
    findMyRoute(`${streetAddress} ${cityAndState}`, [INTERESTS.OUTDOOR, INTERESTS.RELIGION], parseInt(duration));
    return false;
}

async function findMyRoute(address='3415 West 144th St Cleveland OH', interests=[INTERESTS.OUTDOOR, INTERESTS.RELIGION], duration=30) {
    let remainingDuration = duration;
    // don't want to visit the same location twice
    let visitedIds = new Set();
    let visitOrder = [];
    let startCoords = await getMyCoords(address);
    
    while(remainingDuration > 0){
        let coords = visitOrder.length > 0 ?
            convertCoords(visitOrder[visitOrder.length - 1].location.coordinates) : startCoords;
        console.log(coords);
        let places = await getNearbyPlaces(coords, interests);
        places = places.filter(place => !visitedIds.has(place._id));
        console.log(places);
        let distances = await getAllDistances(
            coords,
            places.map(place =>
                convertCoords(place.location.coordinates)
            ),
        );
        distances = distances.map((distance, i) => {
            return {distance: distance, place: places[i]}
        });
        console.log(distances);
        distances = distances.filter(distance => distance.distance <= remainingDuration);
        if(distances.length == 0){
            break;
        }
        console.log(distances);
        let chosen = distances[Math.floor(Math.random() * distances.length)];
        remainingDuration -= chosen.distance;
        visitedIds.add(chosen.place._id);
        visitOrder.push(chosen.place);
    }
    
    console.log(visitOrder);
    closeForm();
    plotRoute(startCoords, visitOrder);
}

function convertCoords(coords){
    if(coords instanceof Array){
        return {
            latitude: coords[1],
            longitude: coords[0]
        }
    }else if(coords.latitude && coords.longitude){
        return [coords.longitude, coords.latitude];
    }
    return coords;
}

function getMyCoords(address){
    return new Promise((resolve, reject) => {

        Radar.geocode({query: address}, (err, res) => {
            if(!err && res.addresses[0]){
                resolve({
                    latitude: res.addresses[0].latitude,
                    longitude: res.addresses[0].longitude
                });
            }else{
                reject(err || new Error('not found'));
            }
        });

    });
}

function getNearbyPlaces(coords, interests=[INTERESTS.OUTDOOR]){
    return new Promise((resolve, reject) => {
        console.log(interests);
        Radar.searchPlaces({
            near: coords,
            radius: 1000,
            categories: interests,
            limit: 10
        }, (err, res) => {
            if(!err){
                resolve(res.places);
            }else{
                reject(err);
            }
        });

    });
}

function getDistance(origin, destination){
    return new Promise((resolve, reject) => {
        apiWait().then(() => {
            Radar.getDistance({
                origin: origin,
                destination: destination,
                modes: ['foot'],
                units: 'imperial'
            },(err, res) => {
                if(!err){
                    resolve(res.routes.foot.duration.value);
                }else{
                    reject(err);
                }
            });
        });
    });
}

function getAllDistances(origin, destinations){
    return Promise.all(destinations.map(destination => getDistance(origin, destination)));
}

//wait a second after every 10 requests so we don't hit the rate limit
function apiWait(){
    if(requestCount < 10){
        requestCount++;
        return prevWait;
     }else{
        prevWait = new Promise(resolve => {
            prevWait.then(() => {
                console.log('setting timeout');
                setTimeout(() =>{
                    console.log('done');
                    resolve();
                }, 1000);
            });
        });
        //prevWait.then(() => new Promise(res => setTimeout(1500, res)));
        requestCount = 0;
        return prevWait;
     }
}

function plotRoute(startingCoords, places){
    mymap.setView(convertCoords(startingCoords).reverse(), 13);
    L.marker(convertCoords(startingCoords).reverse()).addTo(mymap);
    for(let place of places){
        L.marker(place.location.coordinates.reverse()).addTo(mymap);
    }
}

function openForm() {
  document.getElementById("myForm").style.display = "block";
}

function closeForm() {
  document.getElementById("myForm").style.display = "none";
}
