$(document).ready(function() {

var socket = io();
var user = $('#user').text(); // Get logged-in user

socket.emit('get_ad_user_object', {user: user}); // Request the AD User Object in JSON format
$('#nav_dashboard').addClass('active');

// ========== Socket handling ===========

// Receive the AD User Object and populate DOM elements with data
socket.on('ad_user_object', (data) => {
  console.log(data.userObject);
  $('#givenName').text('Hallo ' + data.userObject["givenName"] + ', du bist ein Admin! Cool!');
  $('#userObject').text(data.userObject["dn"]);
  $('#userObjectString').text(data.userObjectString);
});

socket.on('ldap_user_search_result', (data) => {
  alert(JSON.stringify(data.object, undefined, 1));
});

socket.on('alertmessage', (data) => {
  alert(data.msg);
});




// ========== jQuery ===========

//
$('#search').keypress((event) => {
  var keycode = (event.keyCode ? event.keyCode : event.which);
  if(keycode == '13'){ // Enter/Return key
    socket.emit('ldap_search_user', {search: $('#search').val()});
  }
});


});
