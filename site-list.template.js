// This config will not work; it is just an example. 
// Copy this file and rename that copy to `site-list.private.js` and update the contents as required

module.exports = [
  {
    id: "ans",
    name: "A.N. Animal Sanctuary",
    url: "https://animals.com/adoptions/",
    cardSelector: ".elementor-post",
    nameSelector: "h3.elementor-post__title",
    urlSelector: "h3.elementor-post__title > a"
  }
];