var readHost = "http://localhost:8080";
var host = "https://localhost:8443";
var editUrl = host + "/edit";
var metaMaintenanceUrl = editUrl + "/maintenance/meta";
var transferUrl = editUrl + "/transfer";
var urlParsingUrl = editUrl + "/url_parsing";
var editResourceUrl = editUrl + "/resource";
var importPackageUrl = editUrl + "/import";
var contentMaintenanceUrl = editUrl + "/maintenance/content";
var contentUrl = host + "/content";
var resourcesUrl = contentUrl + "/resource";
var contentSuggestionsUrl = contentUrl + "/suggestions";
var queryUrl = resourcesUrl + "?query=";
var contentSpellcheckUrl = contentSuggestionsUrl + "?query=";
var addEncType = "multipart/form-data";
var acceptCharset = "utf-8";
var currentResourceId;
var fuzzySearch = true;
var fuzzyLevel = 0.7;
var awaitedFileTransferReports = new Array();
var awaitedUrlParsingReports = new Array();
var urlParsingCurrentStates = new Object();
var fileTransferCurrentStates = new Object();
var editMetadataUrl = editUrl + "/meta";
var editManifestUrl = editUrl + "/manifest";
var metadataUrl = host + "/meta";
var packUrl = host + "/pack/manifest";
var metadataSuggestionsUrl = metadataUrl + "/suggestions";
var metadataSpellcheckUrl = metadataSuggestionsUrl + "?query=";
var metadataQueryUrl = metadataUrl + "?query=";
var uiblocked = false;
var staticFilters, dynamicFilters;
var facetGroupRegistry;
var selectedMetadataId = "";
var selectedManifestId = "";
var selectedMetadataVersion = "";
var selectedManifestVersion = "";
var ACTION = {
	ASSIGN_PROPERTIES_TO_RESOURCE : "assign metadata",
	CREATE_NEW_RESOURCE : "create new resource"
}
var waitingForAuthentication = false;
var pageIsBuilt = false;
var nonce;
$(document).ready(initialize);

function initialize() {
	$("#metadata-popup").hide();
	$("#wait_animation").hide();
	if (!waitingForAuthentication) {
		$(".container").hide();
		waitForAuthentication();
	}
	if (nonce) {
		showIdentificationFields(false);
		$(".container").show();

	} else {
		showIdentificationFields(true);
		return;
	}
	if (pageIsBuilt)
		return;
	pageIsBuilt = true;
	$("input#queries", $("#resources-container")).keyup(
			handleKeyUpInRequestField);
	$("input#queries", $("#resources-container")).autocomplete(
			{
				source : function(req, add) {
					var queryTerms = req.term.split(/\s+/);
					var queryTerm = queryTerms.pop();
					var stub = queryTerms.join(" ");
					$.ajax({
						type : "GET",
						url : contentSpellcheckUrl + queryTerm,
						headers : {
							accept : "application/atom+xml"
						},
						error : function(msg) {
							prettyAlert("Erreur", msg.responseText, "error")
						},
						success : function(xmlData) {
							var suggestions = new Array();
							var suggestion;
							$(xmlData).find("apiscol\\:word")
									.each(
											function(index, elem) {
												suggestion = $(elem).text()
														.replace(/~\d.?\d*/g,
																"").replace(
																/\*/g, "");
												if ($.inArray(suggestion,
														suggestions) == -1)
													suggestions.push(stub + " "
															+ suggestion);
											});
							add(suggestions);
						}
					});

				},
				select : function(event, ui) {
					submitQuery(ui.item.value)
				}
			});
	$("div#set_url_for_url_resource", $("#resources-container")).bind("keyup",
			handleKeyUpInUrlField);
	$("#suggestions_wrapper", $("#resources-container")).hide();
	$("input#fuzzy_field", $("#resources-container")).bind("change",
			handleFuzzyFieldChange);

	$("#fuzzy_slider", $("#resources-container")).slider({
		min : 0,
		max : 1,
		step : 0.1
	});
	$("#fuzzy_slider", $("#resources-container")).bind("slidechange",
			handleFuzzySliderChange);
	upDateFuzzySlider();
	$("#create_resource", $("#resources-container")).button({
		icons : {
			primary : "ui-icon-star"
		},
		text : false
	});
	$("#create_resource", $("#resources-container")).attr("title",
			"Créer une nouvelle ressource (vide)");
	$("#create_resource", $("#resources-container")).bind("click",
			handleCreateNewResourceButtonClick);
	$("#clear_results", $("#resources-container")).button({
		icons : {
			primary : "ui-icon-refresh"
		},
		text : false
	});
	$("#clear_results", $("#resources-container")).attr("title",
			"Afficher toutes les ressources");
	$("#clear_results", $("#resources-container")).bind("click",
			handleClearResultsButtonClick);
	$("#resource_type_menu", $("#resources-container")).buttonset();
	$("#optimize", $("#resources-container")).button();
	$("#optimize", $("#resources-container")).bind("click",
			handleOptimizeButtonClick);
	$("#update_links", $("#resources-container")).button();
	$("#update_links", $("#resources-container")).bind("click",
			handleUpdateLinksButtonClick);
	$("#delete_all", $("#resources-container")).button();
	$("#delete_all", $("#resources-container")).bind("click",
			handleDeleteAllButtonClick);
	$("#recovery", $("#resources-container")).button();
	$("#recovery", $("#resources-container")).bind("click",
			handleRecoveryButtonClick);
	wait(false);
	showFileProgressBar(false);
	handleFileUpload();
	handleMetadataPopup();
	requestRessourceList();
	initializeMetaData();
	initializeThumbs();
	handleManifestUpload();
	requestManifestList();
}
function handleKeyUpInRequestField(event) {
	if (uiblocked)
		return;
	var query = $("input#queries", $("#resources-container")).val();
	if (query.match(/^\s*$/))
		requestRessourceList();
	else {
		if (event.keyCode && event.keyCode == 13)
			submitQuery(query);
	}

}
function handleFileUpload() {
	$('#file_upload', $("#resources-container"))
			.change(
					function() {
						if (uiblocked)
							return;
						showFileProgressBar(true);
						var etag = getEtag(currentResourceId);
						wait(true);
						var form = $(
								'form#set_file_for_sco_and_assets_resource',
								$("#resources-container"));
						form.children("input[name='resid']").attr("value",
								currentResourceId);
						form.children("input[name='is_archive']")
								.attr(
										"value",
										$("input#is_archive",
												$("#resources-container"))
												.attr("checked") == "checked");
						form.children("input[name='update_archive']").attr(
								"value",
								(isArchiveAutoUpdateActivated() ? "true"
										: "false"));
						var formData = new FormData($(
								'form#set_file_for_sco_and_assets_resource',
								$("#resources-container"))[0]);
						var response = $
								.ajax({
									url : transferUrl,
									type : 'POST',
									headers : {
										accept : "application/atom+xml",
										"If-Match" : etag,
										authorization : nonce
									},
									xhr : function() {
										myXhr = $.ajaxSettings.xhr();
										if (myXhr.upload) {
											myXhr.upload
													.addEventListener(
															'progress',
															fileProgressHandlingFunction,
															false);
										}
										return myXhr;
									},
									success : function(data, textStatus, jqXHR) {
										nonce = extractAuthenticationHeader(response);
										handleFileUploadSuccess(data,
												textStatus, jqXHR);

									},
									error : function(jqXHR, textStatus,
											errorThrown) {
										nonce = extractAuthenticationHeader(response);
										switch (jqXHR.status) {
										case 403:
											showIdentificationFields(true);
											break;
										case 422:
											prettyAlert(
													"Erreur",
													"Un fichier du même nom est déjà présent ou en cours de transmission vers cette ressource.",
													"error");
											uiblocked = false;
											requestRessourceList();
											break;
										default:
											prettyAlert(
													"Erreur",
													"L'envoi du fichier a échoué.",
													"error");
											uiblocked = false;
											requestRessourceList();
											break;
										}

									},
									data : formData,
									cache : false,
									contentType : false,
									processData : false
								});
					});

}
function handleFileUploadSuccess(data, textStatus, jqXHR) {
	wait(false);
	showFileProgressBar(false);
	if ($(data).find("apiscol\\:state").text() == "done") {
		{
			prettyAlert("Fichier transféré",
					"Le fichier a été transféré sur le serveur");

		}
	} else {
		var linkElement = $(data).find("link[rel='self']");
		awaitedFileTransferReports.push(linkElement.attr("href"));
		scanForFileTransferReports();
	}
	requestRessourceList();
}

function scanForFileTransferReports() {
	var transferReportUrl = awaitedFileTransferReports[0];
	if (!transferReportUrl)
		return;

	var response = $.ajax({
		type : "GET",
		url : transferReportUrl,
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			;
			if (msg.status == 403)
				showIdentificationFields(true);
			prettyAlert("Pb authorisation", msg.responseText, "error")
		},
		success : function(result) {
			nonce = extractAuthenticationHeader(response);
			;
			handleTransferReport(result);
		}
	});
}
function handleTransferReport(data) {
	var state = $(data).find("apiscol\\:state").text();
	var link = $(data).find("link[rel='self']").attr("href");
	if (state == "done")
		prettyAlert("Fichier transféré",
				"Le fichier a été transféré et indexé sur le serveur",
				"pushpin");
	else if (state == "aborted")
		prettyAlert("Abandon",
				"Le fichier n'a pas pu être ajouté à la ressource :"
						+ $(data).find("apiscol\\:message").text(), "error");
	else if (state == "pending")
		prettyAlert("En cours", "Le fichier est en cours d'indexation", "slide");

	if (state == "done" || state == "aborted") {
		awaitedFileTransferReports.shift();
		requestRessourceList();
	}
	setTimeout(scanForFileTransferReports, 500);
}
function showFileProgressBar(bool) {
	if (bool)
		$("#file_progress_bar", $("#resources-container")).show();
	else
		$("#file_progress_bar", $("#resources-container")).hide();
}

function zipProgressHandlingFunction(e) {
	if (e.lengthComputable) {
		$('#zip_progress', $("#resources-container")).attr({
			value : e.loaded,
			max : e.total
		});
	}
}
function fileProgressHandlingFunction(e) {
	if (e.lengthComputable) {
		$('#file_progress_bar', $("#resources-container")).attr({
			value : e.loaded,
			max : e.total
		});
	}
}

function submitQuery(query) {
	if (fuzzySearch) {
		query += "&fuzzy=" + fuzzyLevel;
	}
	$.ajax({
		type : "GET",
		url : queryUrl + query,
		headers : {
			accept : "application/atom+xml"
		},
		error : function(msg) {
			prettyAlert("Erreur", msg.responseText, "error")
		},
		success : function(result) {
			handleQueryResult(result);
		}
	});
}
// function askForSuggestions(query) {
//
// $.ajax({
// type : "GET",
// url : spellcheckUrl + query,
// headers : {
// accept : "application/atom+xml"
// },
// error : function(msg) {
// console.log(msg);
// },
// success : function(result) {
// handleSpellcheckResult(result);
// }
// });
// }
function handleQueryResult(xmlData) {
	wait(false);
	populateSuggestionsList(xmlData);
	populateResourcesList(xmlData);
}

function populateSuggestionsList(xmlData) {
	$("#suggestions_wrapper", $("#resources-container")).hide();
	$("#suggestions", $("#resources-container")).empty();
	var suggestions = new Array();
	var suggestion;
	$(xmlData).find("apiscol\\:query").each(function(index, elem) {
		suggestion = $(elem).text().replace(/~\d.?\d*/g, "");
		if ($.inArray(suggestion, suggestions) == -1)
			suggestions.push(suggestion);
	});
	$(xmlData).find("apiscol\\:word").each(function(index, elem) {
		suggestion = $(elem).text();
		if ($.inArray(suggestion, suggestions) == -1)
			suggestions.push(suggestion);
	});
	for ( var int = 0; int < suggestions.length; int++) {
		addItemToSuggestionsList(suggestions[int]);
		if (int == suggestions.length - 1)
			$("#suggestions", $("#resources-container")).append(" ?")
		else
			$("#suggestions", $("#resources-container")).append(", ");
	}

}
function addItemToSuggestionsList(wordOrQuery) {
	$("#suggestions_wrapper", $("#resources-container")).show();
	var $node = $(document.createElement("a"));
	$node.html(wordOrQuery);
	$node.attr("href", "");
	$node.bind("click", handleSuggestionClick)
	$("#suggestions", $("#resources-container")).append($node);

}
function handleSuggestionClick(event) {
	if (uiblocked)
		return;
	event.preventDefault();
	$("input#queries", $("#resources-container")).val($(event.target).text());
	triggerRequest();
}
function triggerRequest() {
	submitQuery($("input#queries", $("#resources-container")).val());
}
function requestRessourceList() {
	wait(true);
	$.ajax({
		type : "GET",
		url : resourcesUrl,
		headers : {
			accept : "application/atom+xml"
		},
		error : function(msg) {
			prettyAlert("Error", msg.responseText, "error");
		},
		success : function(result) {
			populateResourcesList(result);
		}
	});
}
function populateResourcesList(xmlData) {
	wait(false);
	$("#resources_list", $("#resources-container")).empty();
	var resourcesIds = new Array();
	$(xmlData)
			.find("entry")
			.each(
					function(index, elem) {
						var urn = $(elem).find('id').text();
						var type = $(elem).find('category').attr("term");
						var nbFiles = $(elem).find(
								"content[type='application/xml']").find(
								'apiscol\\:files').find('apiscol\\:file').length;
						var meta = $(elem).find("link[rel='describedby']")
								.attr('href');
						var version = $(elem).children("updated").text();
						var downloadElement = $(elem).children(
								"content[type='application/zip']");
						var downloadable = (downloadElement.length > 0);
						var downloadUrl = "";
						if (downloadable)
							downloadUrl = downloadElement.attr("src");
						id = reduceId(urn);
						resourcesIds.push(id);
						var $hit = $(xmlData).find(
								"apiscol\\:hit[resourceId='" + urn + "']");

						addItemToResourcesList(
								id,
								meta,
								type,
								version,
								$(elem)
										.find(
												"link[type='application/atom+xml'][rel='self']")
										.attr("href"), nbFiles > 0, $hit,
								downloadable, downloadUrl);
					});
	if (!currentResourceId || $.inArray(currentResourceId, resourcesIds) < 0)
		if (resourcesIds.length > 0) {
			currentResourceId = resourcesIds[0];
		} else
			currentResourceId = null;
	updateResourceListSelectionCursor();
	loadContentOfCurrentResource();

}
function getResourceListItemByResourceId(resid) {
	var items = $("#resources_list", $("#resources-container")).find("li");
	var textItem;
	for ( var i = 0; i < items.length; i++) {
		textItem = $(items[i]).attr("data-resid");
		if (textItem == resid)
			return $(items[i]);
	}
	return null;
}
function addItemToResourcesList(resId, metaId, type, version, atomLink,
		fileArePresent, $hits, downloadable, downloadUrl) {

	var $node = $(document.createElement("li"));
	$node.text(resId);
	$node.attr("data-resid", resId);
	$node.attr("data-link", atomLink);
	$node.attr("data-version", version);
	$node.attr("data-type", type);
	$node.addClass("resources-list-item");
	$node.bind("click", handleResourceListItemClick)
	$("#resources_list", $("#resources-container")).append($node);

	var $metadataButton = $(document.createElement("button"));
	$metadataButton.addClass("resource_metadata_button");
	$node.append($metadataButton);
	$metadataButton.button({
		icons : {
			primary : "ui-icon-info"
		},
		text : false
	})
	$metadataButton.bind("click", handleResourcePropertiesButtonClick);
	$metadataButton.attr("data-mdid", metaId);
	$metadataButton.attr("title", "Metadonnées : " + metaId);

	var $deleteButton = $(document.createElement("button"));
	$deleteButton.addClass("resource_delete_button");
	$node.append($deleteButton);
	$deleteButton.button({
		icons : {
			primary : "ui-icon-trash"
		},
		text : false
	})
	$deleteButton.bind("click", handleResourceDeleteButtonClick);
	$deleteButton.attr("title", "Supprimer cette ressource");
	if (fileArePresent && type != "url") {
		var $updateArchiveButton = $(document.createElement("button"));
		$updateArchiveButton.addClass("resource_update_archive_button");
		$node.append($updateArchiveButton);
		$updateArchiveButton.button({
			icons : {
				primary : "ui-icon-refresh"
			},
			text : false
		})
		$updateArchiveButton.bind("click",
				handleResourceUpdateArchiveButtonClick);
		$updateArchiveButton.attr("title",
				"Mettre à jour l'archive téléchargeable");
	}
	if (downloadable) {

		var $downloadButton = $(document.createElement("button"));
		$downloadButton.addClass("resource_download_button");
		$node.append($downloadButton);
		$downloadButton.attr("title", "Télécharger cette ressource");
		$downloadButton.attr("data-link", downloadUrl);

		$downloadButton.button({
			icons : {
				primary : "ui-icon-arrowthickstop-1-s"
			},
			text : false
		});
		$downloadButton.bind("click", handleResourceDownloadButtonClick);
	}

	if ($hits && $hits.length > 0) {

		for ( var i = 0; i < $hits.length; i++) {
			var $hitNode = $(document.createElement("p"));
			$hitNode.addClass("snippet-presentation");
			var $hit = $($hits[i]);
			var $fileNode = $(document.createElement("strong"));
			$fileName = $hit.find("apiscol\\:file").text();
			$fileNode.html($fileName + "<br/>");
			$hitNode.append($fileNode);
			$hit
					.find("apiscol\\:match")
					.each(
							function(index, elem) {
								var $span = $(document.createElement("span"));
								$span.html($(elem).text().replace(/\uFFFD/gi,
										" "));
								$span
										.addClass("snippet ui-widget ui-state-default ui-corner-all");
								$hitNode.append($span);
							});
			$node.append($hitNode);
		}

	}
}
function handleResourcePropertiesButtonClick(event) {
	var resid = $(event.target).closest("li").attr("data-resid");
	var mdid = $(event.target).attr("data-mdid");
	var type = $(event.target).closest("li").attr("data-type");
	$("#metadata-popup").data("resid", resid);
	$("#metadata-popup").data("mdid", mdid);
	$("#metadata-popup").data("type", type);
	$("#metadata-popup").data("action", ACTION.ASSIGN_PROPERTIES_TO_RESOURCE);
	$("#metadata-popup").dialog("open");
}
function handleResourceDeleteButtonClick(event) {
	wait(true);
	var resid = $(event.target).closest("li").attr("data-resid");
	var url = editResourceUrl + "/" + resid + "?update="
			+ (isArchiveAutoUpdateActivated() ? "true" : "false");
	var etag = getEtag(resid);
	var response = $.ajax({
		type : "DELETE",
		url : url,
		headers : {
			accept : "application/xml",
			"If-Match" : etag,
			authorization : nonce
		},
		error : function(jqXHR, textStatus, errorThrown) {
			nonce = extractAuthenticationHeader(response);
			;
			switch (jqXHR.status) {
			case 403:
				showIdentificationFields(true);
				prettyAlert("Pb autorisation", msg.responseText, "error");
				break;
			default:
				prettyAlert(
						"Une erreur a empêché la suppression de la ressource.",
						msg.responseText, "error")
				uiblocked = false;
				requestRessourceList();
				break;
			}

		},
		success : function(data) {
			wait(false);
			nonce = extractAuthenticationHeader(response);
			;
			requestRessourceList();
		}
	});
}
function handleResourceUpdateArchiveButtonClick(event) {
	wait(true);
	var resid = $(event.target).closest("li").attr("data-resid");
	var url = editResourceUrl + "/" + currentResourceId;
	sendPutRequest(resid, 'update=true');
}
function handleResourceDownloadButtonClick(event) {
	var url = $(event.target).attr("data-link");
	window.location = url;
}
function handleResourceListItemClick(event) {
	if (uiblocked)
		return;
	var target = event.target;
	if (!$.inArray(target.tagName.toLowerCase(), [ "strong", "span", "em" ]))
		return;
	target = $(target).closest("li");
	currentResourceId = reduceId(target.attr("data-resid"));
	loadContentOfCurrentResource();
	updateResourceListSelectionCursor();
}
function updateResourceListSelectionCursor() {
	$("#resources_list", $("#resources-container")).find("li").each(
			function(index, elem) {
				if (currentResourceId
						&& currentResourceId.length > 0
						&& $(elem).attr("data-resid")
								.indexOf(currentResourceId) >= 0)
					$(elem).addClass("selected")
				else
					$(elem).removeClass("selected")
			})
}
function loadContentOfCurrentResource() {
	if (!currentResourceId) {
		$("#files_list", $("#resources-container")).empty();
		$("#set_file_for_sco_and_assets_resource", $("#resources-container"))
				.hide();
		$("#set_zip_for_sco_and_assets_resource", $("#resources-container"))
				.hide();
		$("#set_url_for_url_resource", $("#resources-container")).hide();
		return;
	}
	var $item = getResourceListItemByResourceId(currentResourceId);
	if (!$item) {
		$("#files_list", $("#resources-container")).empty();
		return;
	}

	wait(true);
	var resourceUrl = $item.attr("data-link");
	var type = $item.attr("data-type");
	if (type == "url") {
		$("#set_file_for_sco_and_assets_resource", $("#resources-container"))
				.hide();
		$("#set_zip_for_sco_and_assets_resource", $("#resources-container"))
				.hide();
		$("#set_url_for_url_resource", $("#resources-container")).show();
	} else {
		$("#set_file_for_sco_and_assets_resource", $("#resources-container"))
				.show();
		$("#set_zip_for_sco_and_assets_resource", $("#resources-container"))
				.show();
		$("#set_url_for_url_resource", $("#resources-container")).hide();
	}
	$.ajax({
		type : "GET",
		url : resourceUrl,
		headers : {
			accept : "application/atom+xml"
		},
		error : function(msg) {
			prettyAlert("Pb autorisation", msg.responseText, "error");
		},
		success : function(result) {
			if (type == "url")
				completeUrlField(result);
			else
				populateFilesList(result);
		}
	});
}
function completeUrlField(xmlData) {
	wait(false);
	$("#files_list", $("#resources-container")).empty();
	var urlElem = $(xmlData).find("content[type='text/html']").find("a");
	var url = "";
	if (urlElem)
		url = urlElem.attr("href");
	$("#set_url_field", $("#resources-container")).val(url);

}
function populateFilesList(xmlData) {
	wait(false);
	$("#files_list", $("#resources-container")).empty();
	$filesElement = $(xmlData).find("content[type='application/xml']").find(
			"apiscol\\:files");
	var mainFileName = $filesElement.attr("main");
	var nbFiles = $filesElement.find('apiscol\\:file').length;
	var archiveCheckBox = $("input#is_archive", $("#resources-container"));
	archiveCheckBox.removeAttr("checked");
	if (nbFiles > 0) {
		archiveCheckBox.attr("disabled", true);
	} else {
		archiveCheckBox.removeAttr("disabled");
	}
	$(xmlData).find("apiscol\\:file").each(
			function(index, elem) {
				var fileName = $(elem).find('title').text();
				addItemToFilesList(fileName, $(elem).find("link[rel='self']")
						.attr("href"), fileName == mainFileName);
			});
}
function addItemToFilesList(fileName, atomLink, isMain) {
	var $node = $(document.createElement("li"));
	if (isMain)
		$node.addClass("main-file");
	$node.text(decodeURIComponent(fileName));
	$node.attr("data-link", atomLink);
	$node.addClass("files-list-item");
	var $deleteButton = $(document.createElement("button"));
	$deleteButton.addClass("file_delete_button");
	$deleteButton.attr("title", "Retirer ce fichier de la ressource")
	$node.append($deleteButton);
	$deleteButton.button({
		icons : {
			primary : "ui-icon-trash"
		},
		text : false
	});
	$deleteButton.bind("click", handleFileDeleteButtonClick);
	$deleteButton.attr("data-file-name", fileName);

	var $downloadButton = $(document.createElement("button"));
	$downloadButton.addClass("file_download_button");
	$downloadButton.attr("title", "Télécharger ce fichier");
	$downloadButton.attr("data-link", atomLink);
	$node.append($downloadButton);
	$downloadButton.button({
		icons : {
			primary : "ui-icon-arrowthickstop-1-s"
		},
		text : false
	});
	$downloadButton.bind("click", handleFileDownloadButtonClick);
	if (!isMain) {
		var $mainButton = $(document.createElement("button"));

		$mainButton.addClass("file_main_button");
		$mainButton.attr("title", "Faire de ce fichier le fichier principal")
		$node.append($mainButton);
		$mainButton.button({
			icons : {
				primary : "ui-icon-flag"
			},
			text : false
		});
		$mainButton.bind("click", handleFileMainButtonClick);
		$mainButton.attr("data-file-name", fileName);
	}

	$("#files_list", $("#resources-container")).append($node)
}
function handleFileDeleteButtonClick(event) {
	if (uiblocked)
		return;
	wait(true);
	var url = editResourceUrl + "/" + currentResourceId + "?fname="
			+ encodeURIComponent($(event.target).attr("data-file-name"))
			+ "&update_archive="
			+ (isArchiveAutoUpdateActivated() ? "true" : "false");
	var etag = getEtag(currentResourceId);
	var response = $
			.ajax({
				type : "DELETE",
				url : url,
				headers : {
					accept : "application/xml",
					"If-Match" : etag,
					authorization : nonce
				},
				error : function(jqXHR, textStatus, errorThrown) {
					nonce = extractAuthenticationHeader(response);
					;
					switch (jqXHR.status) {
					case 403:
						showIdentificationFields(true);
						break;
					case 410:
						alert("Le fichier n'existe plus dans Apiscol, impossible de le supprimer.");
						uiblocked = false;
						requestRessourceList();
						break;
					case 422:
						alert("La ressource est de type url. Elle ne contient pas de fichiers.");
						uiblocked = false;
						requestRessourceList();
						break;
					case 500:
						alert("Une erreur a empêché la suppression du fichier.");
						uiblocked = false;
						requestRessourceList();
						break;
					}

				},
				success : function(data) {
					wait(false);
					nonce = extractAuthenticationHeader(response);
					;
					requestRessourceList();
				}
			});
}
function handleFileDownloadButtonClick(event) {
	window.open($(event.target).attr("data-link"), menubar = "no");
}
function handleFileMainButtonClick(event) {
	var data = "main_filename="
			+ encodeURIComponent($(event.target).attr("data-file-name"))
			+ "&update_archive="
			+ (isArchiveAutoUpdateActivated() ? "true" : "false");
	sendPutRequest(currentResourceId, data);
}
function sendPutRequest(resourceId, data) {
	wait(true);
	var url = editResourceUrl + "/" + resourceId;
	var etag = getEtag(resourceId);
	var response = $.ajax({
		type : "PUT",
		url : url,
		data : data,
		headers : {
			accept : "application/xml",
			"If-Match" : etag,
			authorization : nonce
		},
		error : function(jqXHR, textStatus, errorThrown) {
			nonce = extractAuthenticationHeader(response);
			;
			switch (jqXHR.status) {
			case 403:
				showIdentificationFields(true);
				break;
			case 422:
				alert("Impossible d'effectuer cette opération :" + textStatus);
				uiblocked = false;
				requestRessourceList();
				break;
			default:
				alert("Une erreur a empêché la modification demandée.");
				uiblocked = false;
				requestRessourceList();
				break;
			}

		},
		success : function(result) {
			wait(false);
			nonce = extractAuthenticationHeader(response);
			;
			requestRessourceList();
		}
	});
}
function handleMetadataAssignment(resourceId, metadataId, type) {
	wait(true);
	var data = "mdid=" + metadataId + "&type=" + type + "&update_archive="
			+ (isArchiveAutoUpdateActivated() ? "true" : "false");

	sendPutRequest(resourceId, data);
}
function handleCreateNewResourceButtonClick(event) {
	if (uiblocked)
		return;
	$("#metadata-popup").data("resid", "");
	$("#metadata-popup").data("mdid", "");
	$("#metadata-popup").data("action", ACTION.CREATE_NEW_RESOURCE);
	$("#metadata-popup").dialog("open");

}
function requestVoidResourceCreation(mdid, type) {
	wait(true);
	var response = $.ajax({
		type : "POST",
		url : editResourceUrl,
		data : 'mdid=' + mdid + "&type=" + type,
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		error : function(msg) {
			prettyAlert("Erreur", msg.responseText, "error");
			nonce = extractAuthenticationHeader(response);
			;
			if (msg.status == 403)
				showIdentificationFields(true);
		},
		success : function(data) {
			wait(false);
			nonce = extractAuthenticationHeader(response);
			;
			currentResourceId = reduceId($(data).find('id').text());
			requestRessourceList();
		}
	});
}
function handleOptimizeButtonClick() {
	wait(true);
	var response = $.ajax({
		type : "POST",
		url : contentMaintenanceUrl + "/optimization",
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			;
			prettyAlert("Erreur", "Echec de la requête d'optimisation :" + msg,
					"error");
			if (msg.status == 403)
				showIdentificationFields(true);
		},
		success : function() {
			wait(false);
			nonce = extractAuthenticationHeader(response);
			;
			prettyAlert("Succès", "La requête d'optimisation a réussi");
		}
	});
}
function handleDeleteAllButtonClick(mdid, type) {
	var response = $.ajax({
		type : "POST",
		url : contentMaintenanceUrl + "/deletion",
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			;
			prettyAlert("Erreur", "Echec de la requête de vidage  :" + msg,
					"error");
			if (msg.status == 403)
				showIdentificationFields(true);
			triggerRequest();
		},
		success : function() {
			prettyAlert("Succès", "La requête de vidage a réussi");
			nonce = extractAuthenticationHeader(response);
			;
			triggerRequest();
		}
	});
}
function handleRecoveryButtonClick(mdid, type) {
	var response = $.ajax({
		type : "POST",
		url : contentMaintenanceUrl + "/recovery",
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			;
			prettyAlert("Erreur", "Echec de la requête de restauration  :"
					+ msg, "error");
			if (msg.status == 403)
				showIdentificationFields(true);
			triggerRequest();
		},
		success : function() {
			prettyAlert("Succès", "La requête de restauration a réussi");
			nonce = extractAuthenticationHeader(response);
			;
			triggerRequest();
		}
	});
}
function handleUpdateLinksButtonClick() {
	wait(true);
	var response = $
			.ajax({
				type : "POST",
				url : contentMaintenanceUrl + "/link_update_process",
				headers : {
					accept : "application/atom+xml",
					authorization : nonce
				},
				error : function(msg) {
					nonce = extractAuthenticationHeader(response);
					;
					prettyAlert("Erreur",
							"Echec de la requête de rafraichissement des liens :"
									+ msg, "error");
					if (msg.status == 403)
						showIdentificationFields(true);
				},
				success : function(data) {
					wait(false);
					nonce = extractAuthenticationHeader(response);
					;
					scanForLinkUpdateReports();
				}
			});
}
function scanForLinkUpdateReports() {

	$.ajax({
		type : "GET",
		url : contentUrl + "/maintenance/link_update_process",
		headers : {
			accept : "application/atom+xml"
		},
		error : function(msg) {
			prettyAlert("Erreur", msg.responseText, "error");
		},
		success : function(result) {
			handleLinkUpdateReport(result);
		}
	});
}
function handleLinkUpdateReport(data) {
	var state = $(data).find("state").text();
	if (state == "running") {
		var currentUrl = $(data).find("current_url").text();
		prettyAlert("Scan des liens en cours", "Url en cour de scan :"
				+ currentUrl, "pushpin");
	} else if (state == "inactive") {
		var termination = $(data).find("termination").text();
		var errors = $(data).find("errors").text();
		prettyAlert("Terminé", "Le scan des url est terminé avec le statut "
				+ termination + ". Nb d'erreurs : " + errors,
				termination == "successful" ? null : "error");
	}

	if (state == "running")
		setTimeout(scanForLinkUpdateReports, 500);
}
function handleClearResultsButtonClick(event) {
	if (uiblocked)
		return;
	requestRessourceList();
}
function reduceId(id) {
	if (!id)
		return "";
	return id.substring(id.lastIndexOf(":") + 1);
}
function wait(bool) {
	if (bool)
		$("#wait_animation").show();
	else
		$("#wait_animation").hide();
	uiblocked = bool;
}
function handleMetadataPopup() {
	$("#metadata-popup")
			.dialog(
					{
						autoOpen : false,
						height : 400,
						width : 600,
						modal : true,
						buttons : [
								{
									text : "assigner",
									click : function() {
										var action = $(this).data("action");
										if (action == ACTION.ASSIGN_PROPERTIES_TO_RESOURCE)
											handleMetadataAssignment(
													$(this).data("resid"),
													$("#metadata_uri").val(),
													$(
															"#resource_type_menu>input:checked")
															.attr("id"));

										else if (action == ACTION.CREATE_NEW_RESOURCE)
											requestVoidResourceCreation(
													$("#metadata_uri").val(),
													$(
															"#resource_type_menu>input:checked")
															.attr("id"));
										$(this).dialog("close");

									},
									'class' : 'dialog-ok-button'
								},

								{
									text : "annuler",
									click : function() {
										$(this).dialog("close");
									}
								} ],
						open : function() {
							var action = $(this).data("action");
							if (action == ACTION.ASSIGN_PROPERTIES_TO_RESOURCE) {
								$("#ui-dialog-title-metadata-popup").text(
										"Modifier les propriétés");
								$(".dialog-ok-button>span").text("Modifier");
							} else if (action == ACTION.CREATE_NEW_RESOURCE) {
								$("#ui-dialog-title-metadata-popup").text(
										"Créer une ressource");
								$(".dialog-ok-button>span").text("Créer");
							}
							$("#metadata_uri").val($(this).data("mdid"));
							var type = $(this).data("type");

							if (!type)
								type = "asset"
							$("#" + type).attr('checked', true).button(
									"refresh");
						}
					});
}
function handleKeyUpInUrlField(event) {
	if (uiblocked || event.keyCode != 13)
		return;
	wait(true);

	var url = urlParsingUrl;
	var etag = getEtag(currentResourceId);
	var response = $.ajax({
		type : "POST",
		data : "resid="
				+ currentResourceId
				+ "&url="
				+ encodeURIComponent($("#set_url_field",
						$("#resources-container")).val()) + "&update_archive="
				+ (isArchiveAutoUpdateActivated() ? "true" : "false"),
		url : encodeURI(url),
		headers : {
			accept : "application/xml",
			"If-Match" : etag,
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			;
			if (msg.status == 403)
				showIdentificationFields(true);
			prettyAlert("Erreur", msg.responseText, "error");
		},
		success : function(result) {
			wait(false);
			nonce = extractAuthenticationHeader(response);
			;
			urlParsingRequestCallBack(result);
		}
	});
}
function urlParsingRequestCallBack(data) {
	if ($(data).find("state").text() == "done") {
		{
			prettyAlert("Url scannée",
					"L'url a été enregistrée et scannée sur le serveur de ressources.");

		}
	} else {
		var linkElement = $(data).find("link[rel='self']");
		awaitedUrlParsingReports.push(linkElement.attr("href"));
		scanForUrlParsingReports();
	}
	requestRessourceList();
}
function scanForUrlParsingReports() {
	var urlParsingUrl = awaitedUrlParsingReports[0];
	if (!urlParsingUrl)
		return;

	var response = $.ajax({
		type : "GET",
		url : urlParsingUrl,
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			if (msg.status == 403)
				showIdentificationFields(true);
			prettyAlert("Erreur", msg.responseText, "error");
		},
		success : function(result) {
			nonce = extractAuthenticationHeader(response);
			;
			handleUrlParsing(result);

		}
	});
}
function handleUrlParsing(data) {
	var state = $(data).find("apiscol\\:state").text();
	var link = $(data).find("link[rel='self']").attr("href");
	if (state == "done")
		prettyAlert(
				"Url scannée",
				"L'url a été enregistrée et scannée sur le serveur de ressources.",
				"pushpin");
	else if (state == "aborted")
		prettyAlert("Abandon", "L'url n'a pas pu être enregistrée :"
				+ $(data).find("apiscol\\:message").text(), "error");
	else if (state == "initiated")
		prettyAlert("En cours", "L'url est en cours d'enregistrement", "slide");

	if (state == "done" || state == "aborted") {
		awaitedUrlParsingReports.shift();
		requestRessourceList();
	}
	setTimeout(scanForUrlParsingReports, 500);
}
function handleFuzzyFieldChange() {
	fuzzySearch = $("#fuzzy_field", $("#resources-container")).attr("checked") == "checked";
	upDateFuzzySlider();
	triggerRequest();
}
function isArchiveAutoUpdateActivated() {
	return $("#update_field", $("#resources-container")).attr("checked") == "checked";
}
function upDateFuzzySlider() {
	if (fuzzySearch)
		$("#fuzzy_slider", $("#resources-container")).show();
	else {
		$("#fuzzy_slider", $("#resources-container")).hide();
		return;
	}
	$("#fuzzy_slider", $("#resources-container")).slider({
		value : fuzzyLevel
	});
}
function handleFuzzySliderChange() {
	var newValue = $("#fuzzy_slider", $("#resources-container"))
			.slider("value");
	if (newValue == fuzzyLevel)
		return;
	fuzzyLevel = newValue;
	triggerRequest();
}
function getEtag(resourceId) {
	$item = getResourceListItemByResourceId(resourceId);
	if (!$item)
		return null;
	else
		return $item.attr("data-version");
}
function prettyAlert(title, message, style) {
	message = message.replace(/(<([^>]+)>)/ig, "");
	$("#freeow").empty();
	$("#freeow").freeow(title, message, {
		classes : [ "gray", style ],
		autoHide : style != "error",
		autoHideDelay : 1000
	});
}
function waitForAuthentication() {
	$("#submit").click(
			function() {
				var response = $.ajax({
					type : "POST",
					url : editUrl,
					error : function(msg) {
						nonce = extractAuthenticationHeader(response);
						;
						prettyAlert("Erreur", "Echec de l'authentification  :"
								+ msg, "error");
					},
					success : function(data) {
						prettyAlert("Succès", "Authentification réussie");
						nonce = extractAuthenticationHeader(response);
						;
						initialize();
					},
					headers : {
						accept : "application/xml",
						"Authorization" : $("#login").val() + $("#pass").val()
					},
				});
			});
	waitingForAuthentication = true;
}
function showIdentificationFields(bool) {
	$("body>div.auth").toggle(bool);
	$("body>div:not(.auth)").toggle(!bool);
}

var index = {
	"rights.copyrightandotherrestrictions" : "droits",
	"rights.costs" : "coût",
	"relation" : "relations",
	"educational.intendedenduserrole" : "utilisateur",
	"educational.context" : "contexte",
	"educational.learningresourcetype" : "type de ressource",
	"educational.language" : "langage"
}

function initializeMetaData() {

	staticFilters = new Array();
	dynamicFilters = new Array();
	_showFileProgressBar(false);
	_handleFileUpload();
	$("input#fuzzy_field", $("#metadata-container")).bind("change",
			_handleFuzzyFieldChange);
	$("#fuzzy_slider", $("#metadata-container")).slider({
		min : 0,
		max : 1,
		step : 0.1
	});
	$("#fuzzy_slider", $("#metadata-container")).bind("slidechange",
			_handleFuzzySliderChange);
	upDateFuzzySlider();
	$("input#queries", $("#metadata-container")).keyup(
			_handleKeyUpInRequestField);
	$("input#queries", $("#metadata-container")).autocomplete(
			{
				source : function(req, add) {
					$("#suggestions", $("#metadata-container")).empty();
					var queryTerms = req.term.split(/\s+/);
					var queryTerm = queryTerms.pop();
					var stub = queryTerms.join(" ");
					$.ajax({
						type : "GET",
						url : metadataSpellcheckUrl + queryTerm,
						headers : {
							accept : "application/atom+xml"
						},
						error : function(msg) {
							prettyAlert("Erreur", msg.responseText, "error");
						},
						success : function(xmlData) {
							var suggestions = new Array();
							var suggestion;
							$(xmlData).find("apiscol\\:word")
									.each(
											function(index, elem) {
												suggestion = $(elem).text()
														.replace(/~\d.?\d*/g,
																"").replace(
																/\*/g, "");
												if ($.inArray(suggestion,
														suggestions) == -1)
													suggestions.push(stub + " "
															+ suggestion);
											});
							add(suggestions);
						}
					});

				},
				select : function(event, ui) {
					submitMetadataSearchQuery(ui.item.value)
				}
			});
	$("#clear_facets", $("#metadata-container")).button({
		icons : {
			primary : "ui-icon-refresh"
		},
		text : false
	});
	$("#clear_facets", $("#metadata-container")).attr("title",
			"Afficher toutes les ressources");
	$("#clear_facets", $("#metadata-container")).bind("click",
			_handleClearFacetsButtonClick);
	$("#optimize", $("#metadata-container")).button();
	$("#optimize", $("#metadata-container")).bind("click",
			_handleOptimizeButtonClick);
	$("#delete_all", $("#metadata-container")).button();
	$("#delete_all", $("#metadata-container")).bind("click",
			_handleDeleteAllButtonClick);
	$("#recovery", $("#metadata-container")).button();
	$("#recovery", $("#metadata-container")).bind("click",
			_handleRecoveryButtonClick);
}
function _showFileProgressBar(bool) {
	if (bool)
		$("#file_progress_bar", $("#metadata-container")).show();
	else
		$("#file_progress_bar", $("#metadata-container")).hide();
}
function _handleFileUpload() {
	$('#file_upload', $("#metadata-container")).change(function() {
		if (selectedMetadataId == "")
			_postNewMetadataFile();
		else
			_putMetataDataFileIntoSelectedResource();
	});

}
function _postNewMetadataFile() {
	_showFileProgressBar(true);
	var form = $('form#set_file', $("#metadata-container"));
	var formData = new FormData($('form#set_file')[0]);
	var response = $
			.ajax({
				url : editMetadataUrl,
				type : 'POST',
				headers : {
					accept : "application/atom+xml",
					authorization : nonce
				},
				xhr : function() { // custom xhr
					myXhr = $.ajaxSettings.xhr();
					if (myXhr.upload) { // check if upload
						// property exists
						myXhr.upload.addEventListener('progress',
								_fileProgressHandlingFunction, false);
					}
					return myXhr;
				},
				success : function() {
					nonce = extractAuthenticationHeader(response);
					;
					_handleFileUploadSuccess();
				},
				error : function(jqXHR, textStatus, errorThrown) {
					nonce = extractAuthenticationHeader(response);
					;
					switch (jqXHR.status) {
					case 422:
						alert("Un fichier du même nom est déjà présent ou en cours de transmission vers cette ressource.");
						uiblocked = false;
						requestRessourceList();
						break;
					default:
						alert("Une erreur a empêché l'ajout du fichier.");
						uiblocked = false;
						requestRessourceList();
						break;
					}

				},
				data : formData,
				cache : false,
				contentType : false,
				processData : false
			});
}
function _putMetataDataFileIntoSelectedResource() {
	_showFileProgressBar(true);
	var etag = selectedMetadataVersion;
	var form = $('form#set_file', $("#metadata-container"));
	var formData = new FormData($('form#set_file', $("#metadata-container"))[0]);
	var response = $
			.ajax({
				url : editMetadataUrl + "/" + selectedMetadataId,
				type : 'PUT',
				headers : {
					accept : "application/atom+xml",
					"If-Match" : etag,
					authorization : nonce
				},
				xhr : function() { // custom xhr
					myXhr = $.ajaxSettings.xhr();
					if (myXhr.upload) { // check if upload
						// property exists
						myXhr.upload.addEventListener('progress',
								fileProgressHandlingFunction, false);
					}
					return myXhr;
				},
				success : function(data, textStatus, jqXHR) {
					nonce = extractAuthenticationHeader(response);
					;
					_handleFileUploadSuccess(data, textStatus, jqXHR);
				},
				error : function(jqXHR, textStatus, errorThrown) {
					nonce = extractAuthenticationHeader(response);
					;
					switch (jqXHR.status) {
					case 422:
						alert("Un fichier du même nom est déjà présent ou en cours de transmission vers cette ressource.");
						uiblocked = false;
						requestRessourceList();
						break;
					case 403:
						alert("Pb authentification.");
						uiblocked = false;
						showIdentificationFields(true);
						break;
					default:
						alert("Une erreur a empêché l'ajout du fichier.");
						uiblocked = false;
						requestRessourceList();
						break;
					}

				},
				data : formData,
				cache : false,
				contentType : false,
				processData : false
			});

}
function _fileProgressHandlingFunction(e) {
	if (e.lengthComputable) {
		$('file_progress_bar').attr({
			value : e.loaded,
			max : e.total
		});
	}
}
function _handleFileUploadSuccess(data, textStatus, jqXHR) {
	_showFileProgressBar(false);
	prettyAlert("Fichier transféré",
			"Le fichier a été transféré sur le serveur");
	_triggerRequest();

}
function _handleKeyUpInRequestField(event) {
	if (uiblocked)
		return;
	if (event && event.keyCode && event.keyCode != 13)
		return;
	var query = $("input#queries", $("#metadata-container")).val();
	if (query.match(/^\s*$/) && staticFilters.length == 0
			&& dynamicFilters.length == 0)
		requestMetadataList();
	else
		submitMetadataSearchQuery(query);
}
function submitMetadataSearchQuery(query) {
	if (fuzzySearch) {
		query += "&fuzzy=" + fuzzyLevel;
	}

	var encodedDynamicFilters = encodeAsJsonTable(dynamicFilters).replace(/#/g,
			"%2523");
	$.ajax({
		type : "GET",
		url : metadataQueryUrl + query + "&desc=true&static-filters="
				+ encodeAsJsonTable(staticFilters) + "&dynamic-filters="
				+ encodedDynamicFilters,
		headers : {
			accept : "application/atom+xml"
		},
		error : function(msg) {
			prettyAlert("Erreur", msg.responseText, "error");
		},
		success : function(result) {
			handleMetadataSearchQueryResult(result);
		}
	});
}
function encodeAsJsonTable(table) {
	var encoding = "[";
	for ( var int = 0; int < table.length; int++) {
		encoding += ('"' + table[int] + '"' + (int < table.length ? ',' : ''));
	}

	return encoding + "]";
}
function requestMetadataList() {
	$.ajax({
		type : "GET",
		url : metadataUrl + "?rows=10&desc=true",
		headers : {
			accept : "application/atom+xml"
		},
		error : function(msg) {
			prettyAlert("Erreur", msg.responseText, "error");
		},
		success : function(result) {
			handleMetadataSearchQueryResult(result);
		}
	});
}
function handleMetadataSearchQueryResult(xmlData) {
	selectedMetadataId = "";
	populateMetadataList(xmlData);
	populateFacetsList(xmlData);
	_populateSuggestionsList(xmlData);
	updateSelectedMetadataDisplay();
	getMetadataListForThumbsRetrieval();
}
function populateMetadataList(xmlData) {
	$("#metadata-list", $("#metadata-container")).empty();
	$(xmlData).find("feed").children("entry")
			.each(
					function(index, elem) {
						var urn = $(elem).find('id').text();
						var $hit = $(xmlData).find(
								"apiscol\\:hit[metadataId='" + urn + "']");
						addMetadataEntry($(elem).find("title").text(), $(elem)
								.find("summary").text(), $(elem).find("id")
								.text(), $(elem).children("updated").text(), $(
								elem).find("link[type='text/html']").attr(
								"href"), $(elem).find(
								"link[type='application/lom+xml']")
								.attr("href"), $hit);
					});
}
function populateFacetsList(xmlData) {
	$("#dynamic-facets", $("#metadata-container")).empty();
	$("#static-facets", $("#metadata-container")).empty();
	facetGroupRegistry = new Object();
	$(xmlData).find("apiscol\\:dynamic-facets").each(
			function(index, elem) {
				facetGroupName = $(elem).attr("name");
				var facetGroup = new Object();
				$(elem).find("apiscol\\:taxon").each(
						function(index2, elem2) {
							addDynamicFacetEntry(facetGroupName, $(elem2).attr(
									"identifier"), $(elem2))
						})

			});
	$(xmlData).find("apiscol\\:static-facets").each(function(index, elem) {
		facetGroupName = $(elem).attr("name");
		var facetGroup = new Array();
		$(elem).find("apiscol\\:facet").each(function(index2, elem2) {
			var count = $(elem2).attr("count");
			var value = $(elem2).text();
			facetGroup.push({
				count : count,
				label : value
			});

		})
		addStaticFacetEntry(facetGroupName, facetGroup);
	});
}
function buildHierarchically(index, elem, hierarchicalIndex, intermediateIndex) {
	var ancesterFound = false;
	for ( var int = index.length - 1; int >= 0; int--) {
		var ancester = index[int];
		if (elem.indexOf(ancester) == 0) {
			index.splice(int, 1);
			ancesterFound = true;
			var newIntermediateIndex = new Object();
			newIntermediateIndex[elem] = intermediateIndex;

			buildHierarchically(index, ancester, hierarchicalIndex,
					newIntermediateIndex);
			break;
		}

	}
	if (!ancesterFound)
		if (!plugIntoIndex(elem, intermediateIndex, hierarchicalIndex))
			hierarchicalIndex[elem] = intermediateIndex;
	return hierarchicalIndex;
}
function plugIntoIndex(elem, intermediateIndex, hierarchicalIndex) {
	for ( var key in hierarchicalIndex) {
		if (elem.indexOf(key) == 0) {
			hierarchicalIndex[key][elem] = intermediateIndex;
			return true;
		} else if (hierarchicalIndex[key])
			if (plugIntoIndex(elem, intermediateIndex, hierarchicalIndex[key]))
				return true;
	}
	return false;
}
function addDynamicFacetEntry(facetGroupName, taxonName, group) {
	var $facetGroupElement = facetGroupRegistry[facetGroupName];
	if (!$facetGroupElement) {
		$facetGroupElementContainer = $(document.createElement("li"));
		$facetGroupElement = $(document.createElement("ul"));
		$facetGroupElement.attr("id", facetGroupName + "facet-group");
		$facetGroupElementContainer.text(facetGroupName);
		facetGroupRegistry[facetGroupName] = $facetGroupElement;
		$("#dynamic-facets", $("#metadata-container")).append(
				$facetGroupElementContainer);
		$facetGroupElementContainer.append($facetGroupElement);
	}
	$taxonElement = $(document.createElement("li"));
	$taxonElement.attr("id", taxonName + "taxon-group");
	$taxonElement.text(taxonName);
	$facetGroupElement.append($taxonElement);
	buildLinkHierarchy(facetGroupName, taxonName, $taxonElement, group);
}
function buildLinkHierarchy(facetGroupName, taxonName, $parent, $data) {
	var $facetsListContainer = $(document.createElement("ul"));
	$parent.append($facetsListContainer);
	$data.children("apiscol\\:entry").each(
			function(index, elem) {
				var $facetElement = $(document.createElement("li"));
				var $facetLinkElement = $(document.createElement("a"));
				$facetLinkElement.attr("href", facetGroupName + "::"
						+ taxonName + "::" + $(elem).attr("identifier") + "::"
						+ $(elem).attr("label"));
				$facetLinkElement.bind("click", _handleDynamicFacetClic);
				$facetLinkElement.text($(elem).attr("label") + " ("
						+ $(elem).attr("count") + ") ");
				$facetElement.append($facetLinkElement);
				$facetsListContainer.prepend($facetElement);
				buildLinkHierarchy(facetGroupName, taxonName, $facetElement,
						$(elem));
			});
}

function addHierarchicalFacetEntry(index, taxonName, facetGroupName,
		facetGroup, $facetsListContainer) {
	for ( var entryKey in index) {

		if (index[entryKey]) {
			var $nextContainer = $(document.createElement("ul"));
			$facetElement.append($nextContainer);
			addHierarchicalFacetEntry(index[entryKey], taxonName,
					facetGroupName, facetGroup, $nextContainer);
		}

	}
}
function addStaticFacetEntry(facetGroupName, facetGroup) {
	var $groupElement = $(document.createElement("li"));
	$groupElement.text(tr(facetGroupName));
	var $facetContainerElement = $(document.createElement("ul"));
	$groupElement.append($facetContainerElement);
	$("#static-facets", $("#metadata-container")).append($groupElement);
	for ( var i = 0; i < facetGroup.length; i++) {
		var facet = facetGroup[i];
		var $facetElement = $(document.createElement("li"));
		var $facetLinkElement = $(document.createElement("a"));
		$facetLinkElement.bind("click", _handleStaticFacetClic);
		$facetLinkElement.attr("href", facetGroupName + "::" + facet.label);
		$facetLinkElement.text(facet.label + " (" + facet.count + ") ");
		$facetElement.append($facetLinkElement);
		$facetContainerElement.append($facetElement);
	}
}
function addMetadataEntry(title, desc, metadataId, metadataVersion, restLink,
		downloadLink, $hits) {
	restLink = restLink.replace(host, readHost);
	var $metadataElement = $(document.createElement("li"));
	var $titleElement = $(document.createElement("h4"));
	$titleElement.text(title);
	var $deleteButton = $(document.createElement("button"));
	$deleteButton.addClass("metadata_delete_button");
	$titleElement.append($deleteButton);
	$deleteButton.button({
		icons : {
			primary : "ui-icon-trash"
		},
		text : false
	})
	$deleteButton.bind("click", _handleMetadataDeleteButtonClick);
	$deleteButton.attr("title", "Supprimer cette ressource");

	var $selectButton = $(document.createElement("button"));
	$selectButton.addClass("metadata_select_button");
	$titleElement.append($selectButton);
	$selectButton.button({
		icons : {
			primary : "ui-icon-pin-w"
		},
		text : false
	})
	$selectButton.bind("click", _handleMetadataSelectButtonClick);
	$selectButton.attr("title", "Sélectionner cette ressource");

	$metadataElement.attr("data-mdid", metadataId);
	$metadataElement.attr("data-version", metadataVersion);
	var $descElement = $(document.createElement("span"));
	$descElement.attr("title", desc);
	$descElement.addClass("ui-icon ui-icon-info metadata-info");
	$metadataElement.append($titleElement);
	$titleElement.append($descElement);
	var $restUrlNode = $(document.createElement("p"));
	var $restUrlLink = $(document.createElement("a")).attr("href", restLink)
			.attr("target", "_blank").appendTo($restUrlNode);
	$restUrlLink.text(restLink);
	$metadataElement.append($restUrlNode);
	var $lomfrUrlButton = $(document.createElement("a"));
	$lomfrUrlButton.attr("href", downloadLink);
	$lomfrUrlButton.attr("target", "_blank");
	$restUrlNode.append($lomfrUrlButton);
	$lomfrUrlButton.button({
		icons : {
			primary : "ui-icon-link"
		},
		text : false
	})
	$("#metadata-list", $("#metadata-container")).append($metadataElement);

	if ($hits && $hits.length > 0) {

		for ( var i = 0; i < $hits.length; i++) {
			var $hitNode = $(document.createElement("p"));
			$hitNode.addClass("snippet-presentation");
			var $hit = $($hits[i]);
			$hit
					.find("apiscol\\:match")
					.each(
							function(index, elem) {
								var $span = $(document.createElement("span"));
								$span.html($(elem).text().replace(/\uFFFD/gi,
										" "));
								$span
										.addClass("snippet ui-widget ui-state-default ui-corner-all");
								$hitNode.append($span);
							});
			$metadataElement.append($hitNode);
		}

	}
}
function _handleMetadataDeleteButtonClick(event) {
	var resid = reduceId($(event.target).closest("li").attr("data-mdid"));
	var url = editMetadataUrl + "/" + resid;
	var etag = $(event.target).closest("li").attr("data-version");
	var response = $.ajax({
		type : "DELETE",
		url : url,
		headers : {
			accept : "application/xml",
			"If-Match" : etag,
			authorization : nonce
		},
		error : function(jqXHR, textStatus, errorThrown) {
			nonce = extractAuthenticationHeader(response);
			switch (jqXHR.status) {
			default:
				alert("Une erreur a empêché la suppression de la ressource.");
				uiblocked = false;
				requestRessourceList();
				break;
			}

		},
		success : function(data) {
			nonce = extractAuthenticationHeader(response);
			_triggerRequest()
		}
	});
}
var AUTHENTICATION_INFO_PATTERN = /nextnonce="([^"]+)"/;
function extractAuthenticationHeader(response) {
	var header = response.getResponseHeader('Authentification-Info');
	var match = AUTHENTICATION_INFO_PATTERN.exec(header);
	if (match.length == 0)
		return "";
	return match[1];
}
function _handleMetadataSelectButtonClick(event) {
	selectedMetadataId = reduceId($(event.target).closest("li").attr(
			"data-mdid"));
	selectedMetadataVersion = $(event.target).closest("li")
			.attr("data-version");
	updateSelectedMetadataDisplay();
	$(event.target).attr("checked", "checked");

}
function updateSelectedMetadataDisplay() {
	$("button.metadata_select_button", $("#metadata-container"))
			.each(
					function(index, elem) {
						var id = $(elem).closest("li").attr("data-mdid");
						$(elem).button("option", "disabled",
								id == selectedMetadataId);
						$(elem)
								.button(
										"option",
										"icons",
										{
											primary : (selectedMetadataId != "" && id
													.indexOf(selectedMetadataId) >= 0) ? "ui-icon-pin-s"
													: "ui-icon-pin-w"
										});
					})
}
function _handleFuzzyFieldChange() {
	fuzzySearch = $("#fuzzy_field", $("#metadata-container")).attr("checked") == "checked";
	upDateFuzzySlider();
	_triggerRequest();
}
function upDateFuzzySlider() {
	if (fuzzySearch)
		$("#fuzzy_slider", $("#metadata-container")).show();
	else {
		$("#fuzzy_slider", $("#metadata-container")).hide();
		return;
	}
	$("#fuzzy_slider", $("#metadata-container")).slider({
		value : fuzzyLevel
	});
}
function _handleFuzzySliderChange() {
	var newValue = $("#fuzzy_slider", $("#metadata-container")).slider("value");
	if (newValue == fuzzyLevel)
		return;
	fuzzyLevel = newValue;
	_triggerRequest();
}
function tr(elem) {
	if (index[elem])
		return index[elem];
	else
		return elem;
}
function _triggerRequest() {
	_handleKeyUpInRequestField(null);
}
function _handleStaticFacetClic(event) {
	event.preventDefault();
	var filter = $(event.target).attr("href");
	staticFilters.push(filter);
	_triggerRequest();
}
function _handleDynamicFacetClic(event) {
	event.preventDefault();
	var filter = $(event.target).attr("href");
	dynamicFilters.push(filter);
	_handleKeyUpInRequestField(null);
	_triggerRequest();
}
function _handleClearFacetsButtonClick(e) {
	staticFilters = new Array();
	dynamicFilters = new Array();
	_handleKeyUpInRequestField(null);
}
function _populateSuggestionsList(xmlData) {
	$("#suggestions_wrapper", $("#metadata-container")).hide();
	$("#suggestions", $("#metadata-container")).empty();
	var suggestions = new Array();
	var suggestion;
	$(xmlData).find("apiscol\\:query").each(function(index, elem) {
		suggestion = $(elem).text().replace(/~\d.?\d*/g, "");
		if ($.inArray(suggestion, suggestions) == -1)
			suggestions.push(suggestion);
	});
	$(xmlData).find("apiscol\\:word").each(function(index, elem) {
		suggestion = $(elem).text();
		if ($.inArray(suggestion, suggestions) == -1)
			suggestions.push(suggestion);
	});
	for ( var int = 0; int < suggestions.length; int++) {
		_addItemToSuggestionsList(suggestions[int]);
		if (int == suggestions.length - 1)
			$("#suggestions", $("#metadata-container")).append(" ?")
		else
			$("#suggestions", $("#metadata-container")).append(", ");
	}

}
function _addItemToSuggestionsList(wordOrQuery) {
	$("#suggestions_wrapper", $("#metadata-container")).show();
	var $node = $(document.createElement("a"));
	$node.html(wordOrQuery);
	$node.attr("href", "");
	$node.bind("click", _handleSuggestionClick)
	$("#suggestions", $("#metadata-container")).append($node);

}
function _handleSuggestionClick(event) {
	if (uiblocked)
		return;
	event.preventDefault();
	$("input#queries", $("#metadata-container")).val($(event.target).text());
	_triggerRequest();
}
function reduceId(id) {
	if (!id)
		return "";
	return id.substring(id.lastIndexOf(":") + 1);
}

function _handleOptimizeButtonClick(mdid, type) {
	var response = $.ajax({
		type : "POST",
		url : metaMaintenanceUrl + "/optimization",
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			;
			prettyAlert("Erreur", "Echec de la requête d'optimisation :" + msg,
					"error");
		},
		success : function() {
			nonce = extractAuthenticationHeader(response);
			;
			prettyAlert("Succès", "La requête d'optimisation a réussi");
		}
	});
}
function _handleDeleteAllButtonClick(mdid, type) {
	var response = $.ajax({
		type : "POST",
		url : metaMaintenanceUrl + "/deletion",
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			;
			prettyAlert("Erreur", "Echec de la requête de vidage  :" + msg,
					"error");
			_triggerRequest();
		},
		success : function() {
			prettyAlert("Succès", "La requête de vidage a réussi");
			nonce = extractAuthenticationHeader(response);
			;
			_triggerRequest();
		}
	});
}
function _handleRecoveryButtonClick(mdid, type) {
	var response = $.ajax({
		type : "POST",
		url : metaMaintenanceUrl + "/recovery",
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			;
			prettyAlert("Erreur", "Echec de la requête de restauration  :"
					+ msg, "error");
			_triggerRequest();
		},
		success : function() {
			prettyAlert("Succès", "La requête de restauration a réussi");
			nonce = extractAuthenticationHeader(response);
			;
			_triggerRequest();
		}
	});
}
/*******************************************************************************
 * 
 */
/*******************************************************************************
 * THUMBS
 */
var thumbsUrl = host + "/thumbs";
var thumbsEditionUrl = editUrl + "/thumb";
var metaUrl = host + "/meta";
var suggestIconsUrl = thumbsUrl + "/suggestions";
var currentIconNumber = 0;
var thumbListMax = 0;
var currentMdid;
var defaultIcon;
var thumbEtag;
var metadataIdForThumbs;
var waitingForThumbs;
function initializeThumbs() {
	waitForThumbs(true);
	getMetadataListForThumbsRetrieval();
	$("select#thumb-mdid").change(handleMetadataForThumbSelection);
	$("#thumbs-right-button").button({
		icons : {
			primary : "ui-icon-arrowthick-1-e"
		},
		text : false
	});
	$("#thumbs-left-button").button({
		icons : {
			primary : "ui-icon-arrowthick-1-w"
		},
		text : false
	});
	$("#thumbs-left-button").bind("click", __handleLeftDefilment);
	$("#thumbs-right-button").bind("click", __handleRightDefilment);
	handleImageUpload();
	$('#image_progress_bar', $("#custom-image-input-container")).hide();
}
function getMetadataListForThumbsRetrieval() {
	$.ajax({
		type : "GET",
		url : metaUrl + "?desc=true",
		headers : {
			accept : "application/atom+xml"
		},
		error : function(msg) {
			prettyAlert("Error", msg.responseText, "error");

		},
		success : function(result) {
			refreshMetadataListForThumbs(result);
		}
	});
}
function __handleRightDefilment() {
	currentIconNumber = Math.min(currentIconNumber + 1, thumbListMax);
	refreshThumbsSuggestionsList();
}
function __handleLeftDefilment() {
	currentIconNumber = Math.max(0, currentIconNumber - 1);
	refreshThumbsSuggestionsList();
}
function handleMetadataForThumbSelection(event) {
	if (waitingForThumbs)
		return;
	waitForThumbs(true);
	metadataIdForThumbs = $("select#thumb-mdid>option:selected").attr("id");
	askForMetadataThumbsSuggestions();
}
function askForMetadataThumbsSuggestions() {
	$.ajax({
		type : "GET",
		url : suggestIconsUrl + "?mdid=" + metadataIdForThumbs,
		headers : {
			accept : "application/atom+xml"
		},
		error : function(msg) {
			prettyAlert("Error", msg.responseText, "error");
			waitForThumbs(false);
		},
		success : function(result) {
			handleThumbsSuggestionResults(result);
		}
	});
}
function refreshMetadataListForThumbs(xmlData) {
	populateMetadataListForThumbs(xmlData);
	waitForThumbs(false);
}
function populateMetadataListForThumbs(xmlData) {
	$("#thumb-mdid").empty();
	$(xmlData).find("entry").each(
			function(index, elem) {
				var title = $(elem).find("title").text();
				var url = $(elem).find("link[type='text/html']").attr("href")
						.replace(host, readHost);
				;

				addItemToMetadata(title, url);

			});
	$("#custom-image-input-container").hide();

	refreshThumbsSuggestionsList();
}
function handleThumbsSuggestionResults(xmlData) {
	console.log(xmlData);
	thumbEtag = $(xmlData).find("thumbs").attr("version");
	populateThumbsList(xmlData);
	waitForThumbs(false);
}
function populateThumbsList(xmlData) {
	var newMdid = $(xmlData).find("thumbs").attr("mdid");
	if (newMdid != currentMdid)
		currentIconNumber = 0;
	currentMdid = newMdid;
	$("#thumbs-list").empty();
	$(xmlData).find("thumb").each(function(index, elem) {
		var url = $(elem).find('link').attr("href");

		addItemToIconsList(url, index);
		thumbListMax = index;
	});

	refreshThumbsSuggestionsList();
}
function addItemToIconsList(url, index) {
	var $img = $(document.createElement("img"));
	$img.attr("src", url);
	$img.attr("id", "thumb_" + index);
	$img.bind("click", handleThumbsSuggestionSelection);
	$("#thumbs-list").append($img);
}
function addItemToMetadata(title, url) {
	var $option = $(document.createElement("option"));
	$option.attr("id", url);
	$option.text(title);
	$option.bind("click", handleMetadataSelection);
	$("#thumb-mdid").append($option);
}
function handleMetadataSelection(event) {
	metadataIdForThumbs = $(event.target).attr("id");
	askForMetadataThumbsSuggestions();
	$("#custom-image-input-container").show();
}
function refreshThumbsSuggestionsList() {
	$("#thumbs-list").find("img").each(function(index, elem) {
		if ($(elem).attr("id") == "thumb_" + currentIconNumber)
			$(elem).show();
		else
			$(elem).hide();
		if (!defaultIcon)
			return;
		if ($(elem).attr("src") == defaultIcon)
			$(elem).addClass("default-thumb");
		else
			$(elem).removeClass("default-thumb");
	})
}
function handleThumbsSuggestionSelection(event) {
	waitForThumbs(true);
	var imageUrl = $(event.target).attr("src");
	var response = $.ajax({
		type : "PUT",
		url : thumbsEditionUrl + "?mdid=" + encodeURIComponent(currentMdid)
				+ "&src=" + encodeURIComponent(imageUrl),
		headers : {
			accept : "application/atom+xml",
			"If-Match" : thumbEtag,
			authorization : nonce
		},
		error : function(msg) {
			nonce = extractAuthenticationHeader(response);
			;
			if (msg.status == 403)
				showIdentificationFields(true);
			prettyAlert("Pb d'autorisation", msg.responseText, "error")
		},
		success : function(result) {
			waitForThumbs(false);
			nonce = extractAuthenticationHeader(response);
			;
			thumbEtag = $(result).find("thumbs").attr("version");
			defaultIcon = $(result).find("thumbs").find(
					"thumb[status='default']").text();
			refreshThumbsSuggestionsList();
		}
	});
}
function handleImageUpload() {

	$('#image_upload', $("#custom-image-input-container")).change(
			function() {
				$('#image_progress_bar', $("#custom-image-input-container"))
						.show();
				var form = $('form#set_custom_thumb',
						$("#custom-image-input-container"));
				form.children("input[name='mdid']").attr("value", currentMdid);

				var formData = new FormData(form[0]);
				var response = $.ajax({
					url : thumbsEditionUrl,
					type : 'POST',
					headers : {
						accept : "application/atom+xml",
						"If-Match" : thumbEtag,
						authorization : nonce
					},
					xhr : function() { // custom xhr
						myXhr = $.ajaxSettings.xhr();
						if (myXhr.upload) { // check if upload
							// property exists
							myXhr.upload.addEventListener('progress',
									imageProgressHandlingFunction, false);
						}
						return myXhr;
					},
					success : function(data, textStatus, jqXHR) {
						nonce = extractAuthenticationHeader(response);
						;
						handleImageUploadSuccess(data, textStatus, jqXHR);

					},
					error : function(jqXHR, textStatus, errorThrown) {
						nonce = extractAuthenticationHeader(response);
						;
						switch (jqXHR.status) {
						case 403:
							showIdentificationFields(true);
							break;
						default:
							prettyAlert("Erreur",
									"Echec de l'envoi de l'image.", "error");
							break;
						}

					},
					data : formData,
					cache : false,
					contentType : false,
					processData : false
				});
			});

}
function handleImageUploadSuccess(data, textStatus, jqXHR) {
	$('#image_progress_bar', $("#custom-image-input-container")).hide();
	prettyAlert("Image transférée", "L'image a été transférée");
	askForMetadataThumbsSuggestions(metadataIdForThumbs)

}
function imageProgressHandlingFunction(e) {
	if (e.lengthComputable) {
		$('#image_progress_bar', $("#custom-image-input-container")).attr({
			value : e.loaded,
			max : e.total
		});
	}
}
function waitForThumbs(bool) {
	waitingForThumbs = bool;
	if (bool)
		$("select#thumb-mdid").attr("disabled", "disabled");
	else
		$("select#thumb-mdid").removeAttr("disabled");
	$("#thumbs-right-button").toggle(!bool);
	$("#thumbs-left-button").toggle(!bool);
	$("#thumbs-preload").toggle(bool);
	$("#thumbs-list").toggle(!bool);
}
function handleManifestUpload() {
	$('#manifest_upload', $("#manifests-container")).change(function() {
		if (selectedManifestId == "")
			postNewManifest();
		else
			putManifestIntoSelectedResource();
	});
	showManifestProgressBar(false);

}
function putManifestIntoSelectedResource() {
	showManifestProgressBar(true);
	var etag = selectedManifestVersion;
	var form = $('form#set_imsld_manifest', $("#manifests-container"));
	var formData = new FormData($('form#set_imsld_manifest')[0]);
	var response = $.ajax({
		url : editManifestUrl + "/" + selectedManifestId,
		type : 'PUT',
		headers : {
			accept : "application/atom+xml",
			"If-Match" : etag,
			authorization : nonce
		},
		xhr : function() { // custom xhr
			myXhr = $.ajaxSettings.xhr();
			if (myXhr.upload) { // check if upload
				// property exists
				myXhr.upload.addEventListener('progress',
						manifestProgressHandlingFunction, false);
			}
			return myXhr;
		},
		success : function(data, textStatus, jqXHR) {
			nonce = extractAuthenticationHeader(response);
			handleManifestUploadSuccess(data, textStatus, jqXHR);
		},
		error : function(jqXHR, textStatus, errorThrown) {
			nonce = extractAuthenticationHeader(response);
			switch (jqXHR.status) {
			case 403:
				alert("Pb authentification.");
				uiblocked = false;
				showIdentificationFields(true);
				break;
			default:
				alert("Une erreur a empêché l'ajout du fichier.");
				uiblocked = false;
				requestManifestList();
				break;
			}

		},
		data : formData,
		cache : false,
		contentType : false,
		processData : false
	});

}
function postNewManifest() {
	showManifestProgressBar(true);
	var form = $('form#set_imsld_manifest', $("#manifests-container"));
	var formData = new FormData($('form#set_imsld_manifest')[0]);
	var response = $.ajax({
		url : editManifestUrl,
		type : 'POST',
		headers : {
			accept : "application/atom+xml",
			authorization : nonce
		},
		xhr : function() { // custom xhr
			myXhr = $.ajaxSettings.xhr();
			if (myXhr.upload) { // check if upload
				// property exists
				myXhr.upload.addEventListener('progress',
						manifestProgressHandlingFunction, false);
			}
			return myXhr;
		},
		success : function() {
			nonce = extractAuthenticationHeader(response);
			handleManifestUploadSuccess();
		},
		error : function(jqXHR, textStatus, errorThrown) {
			nonce = extractAuthenticationHeader(response);
			switch (jqXHR.status) {
			case 999:
				alert("Ici ton message d'erreur.");
				uiblocked = false;
				requestManifestList();
				break;
			default:
				alert("Une erreur a empêché l'ajout du fichier.");
				uiblocked = false;
				requestManifestList();
				break;
			}

		},
		data : formData,
		cache : false,
		contentType : false,
		processData : false
	});
}
function handleManifestUploadSuccess(data, textStatus, jqXHR) {
	showManifestProgressBar(false);
	prettyAlert("Manifest transféré",
			"Le manifeste a été transféré sur le serveur");
	requestManifestList();

}
function requestManifestList() {
	$.ajax({
		type : "GET",
		url : packUrl,
		headers : {
		// accept : "application/atom+xml"
		},
		error : function(msg, a, b) {
			prettyAlert("Erreur", msg.responseText, "error");
		},
		success : function(result) {
			handleManifestListQueryResult(result);
		}
	});
}
function handleManifestListQueryResult(xmlData) {
	selectedMetadataId = "";
	populateManifestsList(xmlData);
	updateSelectedManifestDisplay();
}
function populateManifestsList(xmlData) {
	$("#manifests-list", $("#manifests-container")).empty();
	$(xmlData).find("feed").children("entry").each(
			function(index, elem) {
				console.log(elem)
				var urn = $(elem).find('id').text();
				addManifestsEntry($(elem).find("title").text(), $(elem).find(
						"id").text(), $(elem).children("updated").text(), $(
						elem).find("link[type='text/html']").attr("href"), $(
						elem).find("link[type='application/lom+xml']").attr(
						"href"), $(
								elem).find("link[type='application/lom+xml']").attr(
								"href"));
			});
}
function addManifestsEntry(title, manifestId, manifestVersion, restLink, metadataLink) {
	restLink = restLink.replace(host, readHost);
	var $manifestElement = $(document.createElement("li"));
	var $titleElement = $(document.createElement("h4"));
	$titleElement.text(title);
	var $deleteButton = $(document.createElement("button"));
	$deleteButton.addClass("manifest_delete_button");
	$titleElement.append($deleteButton);
	$deleteButton.button({
		icons : {
			primary : "ui-icon-trash"
		},
		text : false
	})
	$deleteButton.bind("click", handleManifestDeleteButtonClick);
	$deleteButton.attr("title", "Supprimer ce manifeste");

	var $selectButton = $(document.createElement("button"));
	$selectButton.addClass("manifest_select_button");
	$titleElement.append($selectButton);
	$selectButton.button({
		icons : {
			primary : "ui-icon-pin-w"
		},
		text : false
	})
	$selectButton.bind("click", handleManifestSelectButtonClick);
	$selectButton.attr("title", "Sélectionner ce manifeste");

	$manifestElement.attr("data-mfid", manifestId);
	$manifestElement.attr("data-version", manifestVersion);
	$manifestElement.append($titleElement);
	var $restUrlNode = $(document.createElement("p"));
	var $restUrlLink = $(document.createElement("a")).attr("href", restLink)
			.attr("target", "_blank").appendTo($restUrlNode);
	$restUrlLink.text(restLink);
	$manifestElement.append($restUrlNode);
	var $lomfrUrlButton = $(document.createElement("a"));
	$lomfrUrlButton.attr("href", metadataLink);
	$lomfrUrlButton.attr("target", "_blank");
	$restUrlNode.append($lomfrUrlButton);
	$lomfrUrlButton.button({
		icons : {
			primary : "ui-icon-link"
		},
		text : false
	})
	$("#manifests-list", $("#manifests-container")).append($manifestElement);
}

function handleManifestSelectButtonClick(event) {
	selectedManifestId = reduceId($(event.target).closest("li").attr(
			"data-mfid"));
	selectedManifestVersion = $(event.target).closest("li")
			.attr("data-version");
	updateSelectedManifestDisplay();
	$(event.target).attr("checked", "checked");

}
function handleManifestDeleteButtonClick(event) {
	var resid = reduceId($(event.target).closest("li").attr("data-mfid"));
	var url = editManifestUrl + "/" + resid;
	var etag = $(event.target).closest("li").attr("data-version");
	var response = $.ajax({
		type : "DELETE",
		url : url,
		headers : {
			accept : "application/xml",
			"If-Match" : etag,
			authorization : nonce
		},
		error : function(jqXHR, textStatus, errorThrown) {
			nonce = extractAuthenticationHeader(response);
			switch (jqXHR.status) {
			default:
				alert("Une erreur a empêché la suppression de la ressource.");
				uiblocked = false;
				requestRessourceList();
				break;
			}

		},
		success : function(data) {
			nonce = extractAuthenticationHeader(response);
			requestManifestList()
		}
	});
}
function updateSelectedManifestDisplay() {
	$("button.manifest_select_button", $("#manifests-container"))
			.each(
					function(index, elem) {
						var id = $(elem).closest("li").attr("data-mfid");
						$(elem).button("option", "disabled",
								id == selectedManifestId);
						$(elem)
								.button(
										"option",
										"icons",
										{
											primary : (selectedManifestId != "" && id
													.indexOf(selectedManifestId) >= 0) ? "ui-icon-pin-s"
													: "ui-icon-pin-w"
										});
					})
}
function showManifestProgressBar(bool) {
	if (bool)
		$("#manifest_progress_bar", $("#manifests-container")).show();
	else
		$("#manifest_progress_bar", $("#manifests-container")).hide();
}
function manifestProgressHandlingFunction(e) {
	if (e.lengthComputable) {
		$('#manifest_progress_bar', $("#manifests-container")).attr({
			value : e.loaded,
			max : e.total
		});
	}
}