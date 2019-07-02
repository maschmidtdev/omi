$(document).ready(function() {

var socket = io();
var user = $('#user').text(); // Get logged-in user

socket.emit('get_ad_user_object', {user: user}); // Request the AD User Object in JSON format
socket.emit('get_db_roles');

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

socket.on('db_roles', (data) => {
  data.result.forEach((role) => {
    // $('#role-list').append('<li class="card col s12">' + role.role_name + '<i class="material-icons right-align">delete_forever</i>' + '</li>');
    $('#role-list').append('<li id="role_'+role.role_name+'" class="collection-item"><div>'+role.role_name+'<a class="secondary-content delete"><i class="material-icons red-text text-darken-2">delete_forever</i></a></div></li>');
  });
});

socket.on('db_role_added', (data) => {
  $('#role-list').append('<li id="role_'+data.role+'" class="collection-item"><div>'+data.role+'<a class="secondary-content delete"><i class="material-icons red-text text-darken-2">delete_forever</i></a></div></li>');
});

socket.on('db_role_deleted', (data) => {
  $('#role_'+data.role).remove();
});


// ========== jQuery ===========
$("#addNewRole").click( () => {
  if($("#roleName").val() !== ''){
    socket.emit('add_role', {role: $("#roleName").val()});
  } else {
    alert("Role name field can't be empty!");
    $("#roleName").val('');
  }
});

$('#roleName').keypress((event) => {
  var keycode = (event.keyCode ? event.keyCode : event.which);
  if(keycode == '13'){ // Enter/Return key
    if($("#roleName").val() !== ''){
      socket.emit('add_role', {role: $("#roleName").val()});
      $("#roleName").val('');
    } else {
      alert("Role name field can't be empty!");
    }
  }
});

$("ul").on("click", ".delete", function(){
  var role = $(this).parent().text().replace('delete_forever', '');
  socket.emit('delete_role', {role: role});
});

});
