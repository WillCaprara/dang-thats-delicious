//Library to make http requests (sort of like fetch) with some nice little extras like the ability to cancel requests.
const axios = require('axios');
//Sanitize data
import dompurify from 'dompurify';

function searchResultsHtml(stores) {
    return stores.map(store => {
        return `
            <a href="/store/${store.slug}" class="search__result">
                <strong>${store.name}</strong>
            </a>
        `;
    }).join(''); //map will return an array, and we need a string of html, thats what the join will do.
}

function typeAhead(search) {
    if(!search) return;

    const searchInput = search.querySelector('input[name="search"]');
    const searchResults = search.querySelector('.search__results');

    //Listen for an inpur event on that searchInput.
    //.on is a shortcut to addEventListener that is available to use because of bling.js.
    searchInput.on('input', function() {
        //If there is no value, quit it!
        if(!this.value) {
            searchResults.style.display = 'none';
            return; //stop!
        }

        //show the search results
        searchResults.style.display = 'block';

        axios
            .get(`/api/search?q=${this.value}`)
            .then(res => {
                if(res.data.length) {
                    searchResults.innerHTML = dompurify.sanitize(searchResultsHtml(res.data));
                    return;
                }
                //tell them that nothing came back
                searchResults.innerHTML = dompurify.sanitize(`<div class="search__result">No results for ${this.value} found!</div>`);
            })
            .catch(err => {
                console.log(err);
            });
    });

    //Handle keyboard inputs to navigate the search results.
    //38 -> Up
    //40 -> Down
    //13 -> Enter
    searchInput.on('keyup', (e) => {
        //If they aren't pressing up, down or enter, who cares
        if(![38, 40, 13].includes(e.keyCode)) {
            return;
        }
        
        //Active class to mark each search result as active
        const activeClass = 'search__result--active';
        //Every time that we press up or down keys, we are going to find the current one. And the way to do that is to find which one has the active class.
        const current = search.querySelector(`.${activeClass}`);
        const items = search.querySelectorAll('.search__result')
        //This variable is a 'let' and not a 'const' because we are going to be updating it.
        //We are going to figure out what are we currently on, and if someone presses down or up which one is going to be the next one.
        let next;
        //If they press down, and there is a current element selected...
        if(e.keyCode === 40 && current) {
            //If I'm on the last one, there is no next element sibling so it will go to the first item in our array.
            next = current.nextElementSibling || items[0];
        }
        //If they press down, and there is no current (so its the first time)...
        else if(e.keyCode === 40) {
            next = items[0];
        }
        //If they press up, and there is a current one...
        else if(e.keyCode === 38 && current) {
            next = current.previousElementSibling || items[items.length - 1];
        }
         //If they press up, and there is no current (so its the first time)...
         else if(e.keyCode === 38) {
            next = items[items.length - 1];
        }
        //If someone hits enter, and there is a current value with an href...
        else if(e.keyCode == 13 && current.href) {
            window.location = current.href;
            return;
        }
        
        if(current) {
            current.classList.remove(activeClass);
        }
        next.classList.add(activeClass);
    });
}

export default typeAhead;