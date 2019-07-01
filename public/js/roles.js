$(document).ready(function() {

var socket = io();
var user = $('#user').text(); // Get logged-in user

socket.emit('get_ad_user_object', {user: user}); // Request the AD User Object in JSON format

// ========== Socket handling ===========

// Receive the AD User Object and populate DOM elements with data
socket.on('ad_user_object', (data) => {
  console.log(data.userObject);
  $('#givenName').text('Hallo ' + data.userObject["givenName"] + ', du bist ein Admin! Cool!');
  $('#userObject').text(data.userObject["dn"]);
  $('#userObjectString').text(data.userObjectString);
});

socket.on('alertmessage', (data) => {
  alert(data.msg);
});




// ========== jQuery ===========


});
