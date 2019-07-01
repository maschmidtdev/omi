$(document).ready(function() {

var socket = io();
var user = $('#user').text(); // Get logged-in user

socket.emit('get_ad_user_object', {user: user}); // Request the AD User Object in JSON format
socket.emit('get_db_users');

// ========== Socket handling ===========

// Receive the AD User Object and populate DOM elements with data
socket.on('ad_user_object', (data) => {
  console.log(data.userObject);
  $('#givenName').text('Hallo ' + data.userObject["givenName"] + ', du bist ein Admin! Cool!');
  $('#userObject').text(data.userObject["dn"]);
  $('#userObjectString').text(data.userObjectString);
});

socket.on('db_users', (data) => {
  data.users.forEach((user) => {
    $('#user-list').append('<li class="card col s12">' + user.username + ' | ' + user.role + '</li>');
  });
});

socket.on('alertmessage', (data) => {
  alert(data.msg);
});




// ========== jQuery ===========


});
