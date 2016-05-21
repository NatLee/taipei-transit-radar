var _body = document.getElementsByTagName("body")[0];

function init() {
  $("#change")[0].addEventListener("click", changeEvent);
  $("#search")[0].addEventListener("click", searchEvent);

}

function changeEvent(e) {
  var startValue = $("#start")[0].value;
  var endValue = $("#end")[0].value;

  $("#start")[0].value = endValue;
  $("#end")[0].value = startValue;


  //$("#start")[0].value(end);
  //$("#end")[0].value(start);


}


function searchEvent(e) {
  
  var startValue = $("#start")[0].value;
  var endValue = $("#end")[0].value;
  alert("起點:" + startValue + "終點:"+endValue);

}



init();