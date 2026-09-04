/* MDAC registration page inline scripts, fetched 2026-09-04, session tokens scrubbed. Reference only. */

            $(function () {
                $("#clock").clock();
            });



            function validateNumber(elmnt, content) {
                //if it is character, then remove it..
                if (isNaN(content)) {
                    elmnt.value = removeNonNumeric(content);
                    return;
                }
            }

            function convert(val) {
                var amaun = CurrencyFormatted(val);
                amaun = CommaFormatted(amaun);
                return amaun;
            }

            function removeNonNumeric(strString)
            {
                var strValidCharacters = "1234567890+-";
                var strReturn = "";
                var strBuffer = "";
                var intIndex = 0;
                // Loop through the string
                for (intIndex = 0; intIndex < strString.length; intIndex++)
                {
                    strBuffer = strString.substr(intIndex, 1);
                    // Is this a number
                    if (strValidCharacters.indexOf(strBuffer) > -1)
                    {
                        strReturn += strBuffer;
                    }
                }
                return strReturn;
            }

            $(document).ready(function () {
                $("ul#nav li").attr("onclick", "return true");
                $('form').submit(function () {
                });

                $('.uppercase').each(function () {
                    $(this).blur(function () {
                        $(this).val($(this).val().toUpperCase());
                    });
                });

            });



        

/* ===== SCRIPT BLOCK ===== */

            var allCountry = "ALL";
            var captcha;
            let verifyResult = null;
            
            $(document).ready(function () {
                document.getElementById("formAccommodation").style.display = "none";
                
                $('#accommodationAddress1').bind("input", function(e) {
                    //var blockSpecialRegex = /[^A-Za-z0-9\/\-@(),']/g;
                    var blockSpecialRegex = /[^A-Za-z0-9\/\-@(),' \s]/g;

                    let txtOrig = $(this).val();
                    let txtFinal = txtOrig.replace(blockSpecialRegex, '');
                    if (txtOrig !== txtFinal) {
                      // Some blocked special chars was found and removed
                      // Warning: this will move the cursor to the end!
                      $(this).val(txtFinal);
                    }
                  })
                  
                  $('#accommodationAddress2').bind("input", function(e) {
                    //var blockSpecialRegex = /[^A-Za-z0-9\/\-@(),']/g;
                    var blockSpecialRegex = /[^A-Za-z0-9\/\-@(),' \s]/g;
                    let txtOrig = $(this).val();
                    let txtFinal = txtOrig.replace(blockSpecialRegex, '');
                    if (txtOrig !== txtFinal) {
                      // Some blocked special chars was found and removed
                      // Warning: this will move the cursor to the end!
                      $(this).val(txtFinal);
                    }
                  })
                  
                  $('#vesselNm').bind("input", function(e) {
                    //var blockSpecialRegex = /[^A-Za-z0-9\/\-@(),']/g;
                    var blockSpecialRegex = /[^A-Za-z0-9\/\-@(),' \s]/g;
                    let txtOrig = $(this).val();
                    let txtFinal = txtOrig.replace(blockSpecialRegex, '');
                    if (txtOrig !== txtFinal) {
                      // Some blocked special chars was found and removed
                      // Warning: this will move the cursor to the end!
                      $(this).val(txtFinal);
                    }
                  })
                
                //Retrieve MDAC_VISA_COUNTRY
                var url = '/mdac/register?searchMdacVisaCountry';
                $.get(url,
                function (data){
                    if(data === 'error'){
                        //do nothing.. just proceed
                    }else if(data === 'proceed'){
                        //do nothing.. just proceed
                    }else{
                        document.getElementById("mdacVisaCountry").value = data;
                        const dataSplit = data.split(",");
                        var showAll = false;
                        for (let i = 0; i < dataSplit.length; i++) {
                            var country = dataSplit[i].trim();
                            if(country === allCountry){
                                showAll = true;
                                break;
                            }
                        }
                        
                        if(showAll){
                            document.getElementById("formAccommodation").style.display = "block";
                        }
                    }
                },'html');
                
                //SET EXP DT +6MONTHS
                /*var tamatPas = new Date();
                tamatPas.setMonth(tamatPas.getMonth() + 6);      
                //$('#passExpDte').datepicker("setStartDate", tamatPas);
                
                $('#passExpDte')
                    .datepicker({
                        format: "dd/mm/yyyy",
                        changeMonth: true,
                        changeYear: true,
                        startDate : tamatPas,
                        orientation: "top"
                    }).on('changeDate', function(e) {
                        // `e` here contains the extra attributes
                        // alert(e.format());
                        $(this).datepicker('hide');
                    });*/
                    var selectedOption = $('#sNation').val();
                        if (selectedOption) {
                        $('#nationality').val(selectedOption);
                    }
                    $('#nationality').change(function () {
                        var selectedOption = $(this).val();
                        $('#sNation').val(selectedOption);
                    });
                    var selectedOption1 = $('#sRegion').val();
                        if (selectedOption1) {
                        $('#region').val(selectedOption1);
                    }
                    $('#region').change(function () {
                        var selectedOption1 = $(this).val();
                        $('#sRegion').val(selectedOption1);
                    });
                    var selectedOption2 = $('#sState').val();
                        if (selectedOption2) {
                        $('#accommodationState').val(selectedOption2);
                    }
                    $('#accommodationState').change(function () {
                        var selectedOption2 = $(this).val();
                        $('#sState').val(selectedOption2);
                    });
                    var selectedOption3 = $('#sCity').val();
                        if (selectedOption3) {
                        $('#accommodationCity').val(selectedOption3);
                    }
                    $('#accommodationCity').change(function () {
                        var selectedOption3 = $(this).val();
                        $('#sCity').val(selectedOption3);
                    });
                    var selectedOption4 = $('#sStay').val();
                        if (selectedOption4) {
                        $('#accommodationStay').val(selectedOption4);
                    }
                    $('#accommodationStay').change(function () {
                        var selectedOption4 = $(this).val();
                        $('#sStay').val(selectedOption4);
                    });
                    var selectedOption5 = $('#sMode').val();
                        if (selectedOption5) {
                        $('#trvlMode').val(selectedOption5);
                    }
                    $('#trvlMode').change(function () {
                        var selectedOption5 = $(this).val();
                        $('#sMode').val(selectedOption5);
                    });
                    var selectedOption6 = $('#sEmbark').val();
                        if (selectedOption6) {
                        $('#embark').val(selectedOption6);
                    }
                    $('#embark').change(function () {
                        var selectedOption6 = $(this).val();
                        $('#sEmbark').val(selectedOption6);
                    });
                    
                    captcha = sliderCaptcha({
                        id: 'captcha',
                        height: 155,
                        PI: Math.PI,
                        sliderL: 42,
                        sliderR: 9,
                        offset: 5, 
                        loadingText: 'Loading...',
                        failedText: 'Try It Again',
                        barText: 'Slide the Puzzle',
                        maxLoadCount: 3,
                        remoteUrl: '/mdac/captcha',
                        setSrc:function () {
                            return '/mdac/images/slider/' + Math.round(Math.random() * 4) + '.jpg';
                        },
                        onSuccess: function () {
                          $('#submit').attr("disabled", false);
                          verifyResult = true;
                        },
                        onFail: function () {
                          $('#submit').attr("disabled", true);
                          verifyResult = null;
                        },
                        onRefresh: function () {
                          $('#submit').attr("disabled", true);
                          verifyResult = null;
                        }
                    });
            });
            
            function isNumberKey(evt)
            {
                var charCode = (evt.which) ? evt.which : event.keyCode;
                if (charCode > 31 && (charCode < 48 || charCode > 57))
                    return false;
                return true;
            }
            
            function isCharacterKey(evt)
            {
                var charCode = (evt.which) ? evt.which : event.keyCode;
                if ((charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122) || charCode == 32)
                    return true;
                return false;
            }
            
            function isNumberCharacterKey(evt)
            {
                var charCode = (evt.which) ? evt.which : event.keyCode;
                if ((charCode >= 48 && charCode <= 57) || (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122) || (charCode == 32))
                    return true;
                return false;
            }
            
            function isNumberCharacterKeyAccom(evt)
            {
                var charCode = (evt.which) ? evt.which : event.keyCode;
                if ((charCode >= 48 && charCode <= 57) || (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122) || (charCode == 64) || (charCode == 47) || (charCode == 45) || (charCode == 40) || (charCode == 41) || (charCode == 44) || (charCode == 39) || (charCode == 32))
                    return true;
                return false;
            }
            
            
            function isNumberCharacterRocKey(evt)
            {
                var charCode = (evt.which) ? evt.which : event.keyCode;
                if ((charCode >= 48 && charCode <= 57) || (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122) || charCode === 45)
                    return true;
                return false;
            }
            
            function isNumberSpecialKey(evt)
            {
                var charCode = (evt.which) ? evt.which : event.keyCode;
                if ((charCode >= 48 && charCode <= 57))
                    return true;
                return false;
            }
            
            function checkEmail() {
                var mail = $("#email").val().trim();
                var filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

                if (!filter.test(mail)) {
                    alert('Please enter a valid email address.');
                    $("#email").val('');
                    return false;
                }
                return true;
            }
            
            function validateEmail(){
                var mail = document.getElementById("email").value;
                var reenter = document.getElementById("confirmEmail").value;       
                    if(mail !== reenter){
                        alert('Your emails do not match. Please try again.');
                        $("#confirmEmail").val('');
                        return false;                        
                    } 
                
                return true;
            }
            
            function validateRegion(){
                var reg = document.getElementById("region").value;
                var reenter = document.getElementById("confirmRegion").value;       
                    if(reg !== reenter){
                        alert('Your country / region code does not match. Please try again.');
                        $("#confirmRegion").val('');
                        return false;                        
                    } 
                
                return true;
            }
            
            function validateMobile(){
                var mob = document.getElementById("mobile").value;
                var reenter = document.getElementById("confirmMobile").value;       
                    if(mob !== reenter){
                        alert('Your mobile no. do not match. Please try again.');
                        $("#confirmMobile").val('');
                        return false;                        
                    } 
                
                return true;
            }
            
            function resetSearch() {
                document.getElementById("passNo").value = '';
                document.getElementById("nationality").value = '';
                document.getElementById("name").value = '';
                document.getElementById("sex").value = '';
                document.getElementById("dob").value = '';
                document.getElementById("passExpDte").value = '';
                document.getElementById("email").value = '';
                document.getElementById("region").value = '';
                document.getElementById("mobile").value = '';
                document.getElementById("arrDt").value = '';
                document.getElementById("depDt").value = '';
                document.getElementById("confirmEmail").value = '';
//                document.getElementById("confirmRegion").value = '';
//                document.getElementById("confirmMobile").value = '';
                document.getElementById("trvlMode").value = '';
                document.getElementById("embark").value = '';
                document.getElementById("vesselNm").value = '';
                
                document.getElementById("passNo").style.background = '';
                document.getElementById("nationality").style.background = '';
                document.getElementById("name").style.background = '';
                document.getElementById("sex").style.background = '';
                document.getElementById("dob").style.background = '';
                document.getElementById("passExpDte").style.background = '';
                document.getElementById("email").style.background = '';
                document.getElementById("region").style.background = '';
                document.getElementById("mobile").style.background = '';
                document.getElementById("arrDt").style.background = '';
                document.getElementById("depDt").style.background = '';
                document.getElementById("confirmEmail").style.background = '';
//                document.getElementById("confirmRegion").style.background = '';
//                document.getElementById("confirmMobile").style.background = '';
                document.getElementById("trvlMode").style.background = '';
                document.getElementById("embark").style.background = '';//
                document.getElementById("vesselNm").style.background = '';
                
                document.getElementById("formAccommodation").style.display = "none";
                
                var showAll = false;
                const mdacVisaCountry = document.getElementById("mdacVisaCountry").value.split(",");
                for (let i = 0; i < mdacVisaCountry.length; i++) {
                    var country = mdacVisaCountry[i].trim();
                    if(country === allCountry){
                        showAll = true;
                        break;
                    }
                }
                
                if(showAll){
                    document.getElementById("formAccommodation").style.display = "block";
                }
                
                document.getElementById("accommodationStay").value = '';
                document.getElementById("accommodationAddress1").value = '';
                document.getElementById("accommodationAddress2").value = '';
                document.getElementById("accommodationPostcode").value = '';
                document.getElementById("accommodationCity").value = '';
                document.getElementById("accommodationState").value = '';
                
                document.getElementById("name").focus();
                verifyResult = null;
                if(captcha){
                    captcha.reset();
                }
            }

            function validateSubmit() {
                console.log(state);
                //var validate = true;
                var passNo = $("#passNo").val();
                var nationality = $("#nationality :selected").val();
                var name = $("#name").val();
                var sex = $("#sex :selected").val();
                var dob = $("#dob").val();
                var passExpDte = $("#passExpDte").val();
                var email = $("#email").val();
                var region = $("#region :selected").val();
                var mobile = $("#mobile").val();
                var arrDt = $("#arrDt").val();
                var depDt = $("#depDt").val();
                var confirmEmail = $("#confirmEmail").val();
//                var confirmRegion = $("#confirmRegion").val();
//                var confirmMobile = $("#confirmMobile").val();
                var trvlMode = $("#trvlMode :selected").val();
                var embark = $("#embark :selected").val();
                var vessel = $("#vesselNm").val();
                
                if (name.trim() === "") {
                    alert("Please enter Name.");
                    //validate = false;
                    return false;
                    $("#name").focus();
                } else if (passNo === "") {
                    alert("Please enter Passport No.");
                    //validate = false;
                    return false;
                    $("#passNo").focus();
                } else if (nationality === "") {
                    alert("Please enter Nationality / Citizenship.");
                    //validate = false;
                    return false;
                    $("#nationality").focus();
                } else if (sex === "") {
                    alert("Please choose Sex.");
                    //validate = false;
                    return false;
                    $("#sex").focus();
                } else if (dob.trim() === "") {
                    alert("Please enter Date of Birth.");
                    //validate = false;
                    return false;
                    $("#dob").focus();
                } else if (passExpDte === "") {
                    alert("Please enter Date of Passport Expiry.");
                    //validate = false;
                    return false;
                    $("#passExpDte").focus();
                } else if (email.trim() === "") {
                    alert("Please enter Email.");
                    //validate = false;
                    return false;
                    $("#email").focus();
                } else if (region === "") {
                    alert("Please select Country / Region Code.");
                    //validate = false;
                    return false;
                    $("#region").focus();
                } else if (mobile.trim() === "") {
                    alert("Please enter Mobile No.");
                    //validate = false;
                    return false;
                    $("#mobile").focus();
                } else if (arrDt === "") {
                    alert("Please enter Date of Arrival.");
                    //validate = false;
                    return false;
                    $("#arrDt").focus();
                } else if (depDt.trim() === "") {
                    alert("Please enter Date of Departure.");
                    //validate = false;
                    return false;
                    $("#depDt").focus();
                } else if (confirmEmail === "") {
                    alert("Please enter Confirm Email.");
                    //validate = false;
                    return false;
                    $("#confirmEmail").focus();
//                } else if (confirmRegion.trim() === "") {
//                    alert("Please enter Confirm Country / Region Code.");
//                    validate = false;
//                    $("#confirmRegion").focus();
//                } else if (confirmMobile === "") {
//                    alert("Please enter Confirm Mobile No.");
//                    validate = false;
//                    $("#confirmMobile").focus();
                } else if (trvlMode.trim() === "") {
                    alert("Please choose Mode of Travel.");
                    //validate = false;
                    return false;
                    $("#trvlMode").focus();
                } else if (embark.trim() === "") {
                    alert("Please choose Last Port of Embarkation before Malaysia.");
                    //validate = false;
                    return false;
                    $("#embark").focus();
                }  else if (vessel.trim() === "") {
                    alert("Please enter Flight / Vessel / Transportation No.");
                    //validate = false;
                    return false;
                    $("#vesselNm").focus();
                } else if(document.getElementById("formAccommodation").style.display !== "none") {
                    var stay = $("#accommodationStay :selected").val();
                    var add1 = $("#accommodationAddress1").val();
                    var postcd = $("#accommodationPostcode").val();
                    var city = $("#accommodationCity :selected").val();
                    var state = $("#accommodationState :selected").val();
                    
                    var add1Scnt = add1.trim().split(' ');
                    
                    if (stay.trim() === "") {
                        alert("Please choose Accommodation of Stay.");
                        //validate = false;
                        return false;
                        $("#accommodationStay").focus();
                    } else if (add1.trim() === "") {
                        alert("Please enter Address (In Malaysia).");
                        //validate = false;
                        return false;
                        $("#accommodationAddress1").focus();
                    } else if (add1Scnt.length < 3) {
                        alert("Please enter Address (In Malaysia) properly.");
                        //validate = false;
                        return false;
                        $("#accommodationAddress1").focus();
                    } else if (state.trim() === "") {
                        alert("Please choose State.");
                        //validate = false;
                        return false;
                        $("#accommodationState").focus();
                    } else if (city.trim() === "") {
                        alert("Please choose City.");
                        //validate = false;
                        return false;
                        $("#accommodationCity").focus();
                    } else if (postcd.trim() === "") {
                        alert("Please enter Postcode.");
                        //validate = false;
                        return false;
                        $("#accommodationPostcode").focus();
                    } else if (postcd.trim().length < 5) {
                        alert("Postcode cannot less than 5 digit!");
                        //validate = false;
                        return false;
                        $("#accommodationPostcode").focus();
                    }
                }
                
                if(verifyResult === null){
                    alert("Please verify the captcha before proceeding");
                    //validate = false;
                    return false;
                }
                
                //return validate;
                return true;
            }
            
            function showAccommodation(val) {
                var x = document.getElementById("formAccommodation");
                var nat = val.trim();
                var showAll = false;
                const mdacVisaCountry = document.getElementById("mdacVisaCountry").value.split(",");
                for (let i = 0; i < mdacVisaCountry.length; i++) {
                    var country = mdacVisaCountry[i].trim();
                    if(country === allCountry){
                        showAll = true;
                        break;
                    }
                }
                if(showAll){
                    x.style.display = "block";
                } else {
                    for (let i = 0; i < mdacVisaCountry.length; i++) {
                        var country = mdacVisaCountry[i].trim();
                        if(nat === country) {
                            x.style.display = "block";
                            break;
                        }else{
                            x.style.display = "none";
                        }
                    }
                }
            }
            
            function retrieveRefCity(category) {
                var url = '/mdac/register?retrieveRefCity&state=' + category;
                $.get(url,
                        function (data) {
                            if (data === 'error') {
                                alert('State selected error');
                            } else {
                                $('.accommodationCity').html(data);
                            }
                        }, 'html');
            }
            
            function retrievePostcode(cityCd) {
                var url = '/mdac/register?retrievePostcode&cityCd=' + cityCd;
                $.get(url,
                        function (data) {
                            if (data === 'error') {
                                alert('City selected error');
                            } else {
                                $('.accommodationPostcode').html(data);
                            }
                        }, 'html');
            }
            
            function retrieveCountryPhone(ctryCd) {
                var url = '/mdac/register?retrieveCountryPhoneCode&ctryCd=' + ctryCd;
                $.get(url,
                        function (data) {
                            if (data === 'error') {
                                alert('Nationality / Citizenship selected error');
                            } else {
                                $('.region').html(data);
                            }
                        }, 'html');
            }
            
            function validateAddress(id) {
                var add = $("#" + id).val().trim().toUpperCase();
                var na = ['NA','N/A', 'NULL', 'NIL'];
                
                if (jQuery.inArray(add, na) !== -1){
                    alert('NA, N/A, NULL, NIL is not allowed for Address (In Malaysia)');
                    $("#" + id).val('');
                    $("#" + id).focus();
                }
            }
        

/* ===== SCRIPT BLOCK ===== */

                                                                                                    $(function () {
                                                                                                        $('#dob')
                                                                                                                .datepicker({
                                                                                                                    format: "dd/mm/yyyy",
                                                                                                                    changeMonth: true,
                                                                                                                    changeYear: true,
                                                                                                                    endDate : '-1d',
                                                                                                                    orientation: "top"
                                                                                                                }).on('changeDate', function(e) {
                                                                                                                    // `e` here contains the extra attributes
                                                                                                                    // alert(e.format());
                                                                                                                    $(this).datepicker('hide');
                                                                                                                });
                                                                                                    });
                                                                                                

/* ===== SCRIPT BLOCK ===== */

                                                                                                    $(function () {
                                                                                                        $('#passExpDte')
                                                                                                                .datepicker({
                                                                                                                    format: "dd/mm/yyyy",
                                                                                                                    changeMonth: true,
                                                                                                                    changeYear: true,
                                                                                                                    startDate : new Date(),
                                                                                                                    orientation: "top"
                                                                                                                }).on('changeDate', function(e) {
                                                                                                                    // `e` here contains the extra attributes
                                                                                                                    // alert(e.format());
                                                                                                                    $(this).datepicker('hide');
                                                                                                                });
                                                                                                    });
                                                                                                

/* ===== SCRIPT BLOCK ===== */

                                                                                                    $(function () {
                                                                                                        $('#arrDt')
                                                                                                                .datepicker({
                                                                                                                    format: "dd/mm/yyyy",
                                                                                                                    //changeMonth: true,
                                                                                                                    //changeYear: true,
                                                                                                                    startDate: new Date(),
                                                                                                                    endDate: '+2d',
                                                                                                                    orientation: "top"
                                                                                                                }).on('changeDate', function(e) {
                                                                                                                    // `e` here contains the extra attributes
                                                                                                                    // alert(e.format());
                                                                                                                    $(this).datepicker('hide');
                                                                                                                    var selected = $(this).val();
                                                                                                                    var from = selected.split("/");
                                                                                                                    var f = new Date(from[2], from[1] - 1, from[0]);
                                                                                                                    
                                                                                                                    $('#depDt').datepicker("setStartDate", f);
                                                                                                                    $('#depDt').val('');
                                                                                                                });
                                                                                                    });
                                                                                                

/* ===== SCRIPT BLOCK ===== */

                                                                                                    $(function () {
                                                                                                        $('#depDt')
                                                                                                                .datepicker({
                                                                                                                    format: "dd/mm/yyyy",
                                                                                                                    changeMonth: true,
                                                                                                                    changeYear: true,
                                                                                                                    startDate: new Date(),
                                                                                                                    orientation: "top"
                                                                                                                }).on('changeDate', function(e) {
                                                                                                                    // `e` here contains the extra attributes
                                                                                                                    // alert(e.format());
                                                                                                                    $(this).datepicker('hide');
                                                                                                                });
                                                                                                    });
                                                                                                