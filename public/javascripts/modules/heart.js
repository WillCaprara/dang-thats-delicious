import axios from 'axios';
import { $ } from './bling';

function ajaxHeart(e) {
    e.preventDefault();
    //Post to this.action because. this = the thing tha this function was called against which is the form tag.
    axios
        .post(this.action)
        .then(res => {
            //"this" = form tag. this.heart is going to be a sub property or sub element inside of it. If you have "this" which is the form tag and have any elements inside the form tag having a name attribute you can access those elements by doing this.name.
            //So... this.heart will give our actual button inside the form tag.
            const isHearted = this.heart.classList.toggle('heart__button--hearted');
            $('.heart-count').textContent = res.data.hearts.length;
            //If you add a class of heart__button--float, it will add a little animation when you heart a store.
            if(isHearted) {
                this.heart.classList.add('heart__button--float')
                //Remove the class after 2.5 seconds (animation finished) because otherwise you will have some invisible hearts left around that can get in the way of clicking other elements.
                setTimeout(() => this.heart.classList.remove('heart__button--float'), 2500);
            }
        })
        .catch(console.error);
};

export default ajaxHeart;