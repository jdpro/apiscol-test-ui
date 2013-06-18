var host = "http://localhost:8080";

var TRANSLATE = {
	'lifecycle.status' : null,
	'droits' : null,
	'coût' : null,
	'utilisateur' : null,
	'type de ressource' : null,
	'langage' : null,
	'contexte' : null,
	'educational_level' : "Niveau éducatif",
	'competency' : "Compétences",
	"enseignement" : "Programmes",
	"discipline" : "discipline",
	"rights.copyrightandotherrestrictions" : "Copyright",
	"rights.costs" : "Payant",
	"educational.place" : "Lieu",
	"educational.intendedenduserrole" : "Utilisateur",
	"lifecycle.contributor.author" : "Auteur",
	"educational.learningresourcetype" : "Type de ressource pédagogique",
	"educational.language" : "Langue de l'utilisateur",
	"educational.educationalmethod" : "Modalité pédagogique",
	"educational.activity" : "Activités induites",
	"general.generalresourcetype" : "Type général de ressource",
	"technical.format" : "Format",
	"educational.context" : "Cadre d'utilisation",
	"educational.tool" : "Outils",
	"learner" : "apprenant",
	"teacher" : "enseignant",
	"school" : "enseignement scolaire",
	"true" : "oui",
	"false" : "non"
};
var seekUrl = host + "/seek?query=";
var spellcheckUrl = host + "/seek/suggestions?query=";
var acceptCharset = "utf-8";
var realTime = true;
var staticFilters, dynamicFilters;
var staticFiltersTexts, dynamicFilterTexts;
var facetGroupRegistry;
var index = {
	"rights.copyrightandotherrestrictions" : "droits",
	"rights.costs" : "coût",
	"relation" : "relations",
	"educational.intendedenduserrole" : "utilisateur",
	"educational.context" : "contexte",
	"educational.level" : "niveau",
	"educational.competency" : "competence",
	"educational.learningresourcetype" : "type de ressource",
	"educational.language" : "langage"
}
function tr(elem) {
	if (index[elem])
		return index[elem];
	else
		return elem;
}
$(document).ready(initialize);

function initialize() {
	$('html').addClass($.fn.details.support ? 'details' : 'no-details');
	staticFilters = new Array();
	dynamicFilters = new Array();
	staticFiltersTexts = new Array();
	dynamicFilterTexts = new Array();
	updateFilterList();
	$("#suggestions_wrapper").hide();
	$("#clear_facets").button({
		icons : {
			primary : "ui-icon-refresh"
		},
		text : false
	});
	$("#clear_facets").attr("title", "Afficher toutes les ressources");
	$("#clear_facets").bind("click", handleClearFacetsButtonClick);
	$("input#query").keyup(handleKeyUpInRequestField);
	$("input#query")
			.autocomplete(
					{
						source : function(req, add) {
							// if (req.match(/^\s*$/))
							// return;
							var queryTerms = req.term.split(/\s+/);
							var queryTerm = queryTerms.pop();
							var stub = queryTerms.join(" ");
							$
									.ajax({
										type : "GET",
										url : spellcheckUrl + queryTerm,
										headers : {
											accept : "application/atom+xml"
										},
										error : function(msg) {
											console.log("Error !: " + msg);
										},
										success : function(xmlData) {
											var suggestions = new Array();
											var suggestion;
											$(xmlData)
													.find(
															"apiscol\\:word, word")
													.each(
															function(index,
																	elem) {
																suggestion = $(
																		elem)
																		.text()
																		.replace(
																				/~\d.?\d*/g,
																				"")
																		.replace(
																				/\*/g,
																				"");
																if ($
																		.inArray(
																				suggestion,
																				suggestions) == -1) {
																	var concat = stub
																			+ " "
																			+ suggestion;
																	suggestions
																			.push({
																				label : concat,
																				value : concat,
																				sourceData : $(
																						elem)
																						.attr(
																								"source") == "data"
																						|| $(
																								elem)
																								.parent()
																								.attr(
																										"source") == "data"
																			});
																}

															});
											add(suggestions);
										}
									});

						},
						select : function(event, ui) {
							submitQuery(ui.item.value)
						}
					});
}
function handleKeyUpInRequestField(event) {
	var query = $("input#query").val();

	if (realTime || !event || (event.keyCode && event.keyCode == 13))
		submitQuery(query);

}

function submitQuery(query) {
	$.ajax({
		type : "GET",
		url : seekUrl + query + "&desc=true&static-filters="
				+ encodeAsJsonTable(staticFilters) + "&dynamic-filters="
				+ encodeAsJsonTable(dynamicFilters) + "&start=0&rows=50",
		headers : {
			accept : "application/atom+xml"
		},
		error : function(msg) {
			console.log("Error !: " + msg);
		},
		success : function(result) {
			handleQueryResult(result);
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

function handleQueryResult(xmlData) {
	populateMetadataList(xmlData);
	populateSuggestionsList(xmlData);
	populateFacetsList(xmlData);
}
function populateMetadataList(xmlData) {
	$("#metadata-list").empty();
	$(xmlData).find("entry").each(
			function(index, elem) {
				console.log(elem)
				var urn = $(elem).find('id').text();
				var link = $(elem).find("link[rel='self'][type='text/html']")
						.attr("href");
				var $hit = $(xmlData).find(
						"apiscol\\:hit[metadataId='" + urn
								+ "'], hit[metadataId='" + urn + "']");
				var thumb = $(elem).find("link[rel='icon']").attr("href");
				addMetadataEntry(link, $(elem).find("title").text(), $(elem)
						.find("summary").text(), thumb, $(elem).find("id")
						.text(), $(elem).find("updated").text(), $hit);
			});
}
function addNotice($link, title) {
	var $metadataElement = $(document.createElement("div"));

	$("#metadata-list").append($metadataElement);
	$noticeElement.apiscol({
		mode : "base",
		closeButton : true
	});
}
function addMetadataEntry(link, title, desc, thumb, metadataId,
		metadataVersion, $hits) {
	var $metadataElement = $(document.createElement("div")).addClass(
			"ui-helper-clearfix mini");
	$metadataElement.attr("style", "clear:left")
	var $titleElement = $(document.createElement("h3")).text(title).attr(
			"style", "float:left").addClass("ui-state-highlight");
	var $thumbContainerNode = $(document.createElement("div")).addClass(
			"thumb-container");
	var $thumbNode = $(document.createElement("img"));
	$thumbNode.attr("src", thumb);

	$metadataElement.attr("data-mdid", metadataId);
	$metadataElement.attr("data-version", metadataVersion);
	$metadataElement.append($thumbContainerNode);
	$thumbContainerNode.append($thumbNode);
	$metadataElement.append($titleElement);
	$("#metadata-list").append($metadataElement);
	var matches = false;
	if ($hits && $hits.length > 0) {
		for ( var i = 0; i < $hits.length; i++) {
			var $hitNode = $(document.createElement("p"));
			$hitNode.attr("style", "float:left");
			$hitNode.addClass("snippet-presentation");
			var $hit = $($hits[i]);
			$hit.find("apiscol\\:match, match").each(function(index, elem) {
				matches = true;
				var $span = $(document.createElement("span"));
				if ($(elem).attr("source") == "data")
					$span.addClass("hit-data-source")
				$span.html($(elem).text().replace(/\uFFFD/gi, " ") + "... ");
				$span.addClass("snippet");

				$hitNode.append($span);
			});
			$metadataElement.append($hitNode);
		}

	}
	if (!matches) {
		$metadataElement.find(".snippet-presentation").text(desc);
	}
	var $noticeElement = $(document.createElement("a")).addClass("apiscol")
			.attr("href", link).text(title).attr("style", "clear:left").hide();
	$metadataElement.append($noticeElement);
	$metadataElement.click(function() {
		if ($metadataElement.find(".apiscol-notice").length > 0)
			$metadataElement.find(".apiscol-notice").show();
		else
			$noticeElement.show().apiscol({
				style : "smoothness",
				closeButton : true
			}).bind(
					'close',
					function() {
						$metadataElement.find(".apiscol-notice").slideUp(
								400,
								function() {
									$metadataElement.addClass("mini");
									$noticeElement.hide();
									$titleElement.show();
									$thumbContainerNode.show();
									$metadataElement.find(
											".snippet-presentation").show();
								});

					});
		$thumbContainerNode.hide();
		$titleElement.hide();
		$metadataElement.find(".snippet-presentation").hide();
		$metadataElement.removeClass("mini");
	})
}
function populateFacetsList(xmlData) {
	$("#dynamic-facets").empty();
	$("#static-facets").empty();
	facetGroupRegistry = new Object();
	$(xmlData).find("apiscol\\:dynamic-facets, dynamic-facets").each(
			function(index, elem) {
				var facetGroupIndex = $(elem).attr("name");
				facetGroupName = TRANSLATE[facetGroupIndex];
				var facetGroup = new Object();
				$(elem).find("apiscol\\:taxon, taxon").each(
						function(index2, elem2) {
							if (facetGroupName)
								addDynamicFacetEntry(facetGroupIndex,
										facetGroupName, $(elem2).attr(
												"identifier"), $(elem2))
						})

			});
	$(xmlData).find("apiscol\\:static-facets, static-facets").each(
			function(index, elem) {
				var facetGroupIndex = $(elem).attr("name");
				facetGroupName = TRANSLATE[facetGroupIndex];
				var facetGroup = new Array();
				$(elem).find("apiscol\\:facet, facet").each(
						function(index2, elem2) {
							var count = $(elem2).attr("count");
							var value = $(elem2).text();
							facetGroup.push({
								count : count,
								label : value
							});

						})
				if (facetGroup.length > 0 && facetGroupName)
					addStaticFacetEntry(facetGroupIndex, facetGroupName,
							facetGroup);
			});
	$("#dynamic-facets").find('details').details();
	$("#static-facets").find('details').details();
}

function addDynamicFacetEntry(facetGroupIndex, facetGroupName, taxonName, group) {
	var $facetGroupElement = facetGroupRegistry[facetGroupIndex];
	if (!$facetGroupElement) {
		$facetGroupElementContainer = $(document.createElement("details"))
				.addClass("open").attr("open", "open");
		$facetGroupElement = $(document.createElement("div")).attr("id",
				facetGroupIndex + "facet-group");
		$facetGroupTitleContainer = $(document.createElement("summary")).text(
				facetGroupName).appendTo($facetGroupElementContainer);
		facetGroupRegistry[facetGroupIndex] = $facetGroupElement;
		$("#dynamic-facets").append($facetGroupElementContainer);
		$facetGroupElementContainer.append($facetGroupElement);
	}
	$taxonElement = $(document.createElement("details")).addClass("open").attr(
			"open", "open");
	$taxonElement.attr("id", taxonName + "taxon-group");
	$taxonGroupNameElement = $(document.createElement("summary"));
	$taxonGroupNameElement.text(taxonName);
	$taxonElement.append($taxonGroupNameElement);
	$facetGroupElement.append($taxonElement);
	buildLinkHierarchy(facetGroupIndex, facetGroupName, taxonName,
			$taxonElement, group);

}
function buildLinkHierarchy(facetGroupIndex, facetGroupName, taxonName,
		$parent, $data) {
	console.log(facetGroupIndex, facetGroupName, taxonName,
			$parent, $data)
	var $facetsListContainer = $(document.createElement("ul"));
	$parent.append($facetsListContainer);
	$data.children("apiscol\\:entry, entry").each(
			function(index, elem) {
				var $facetElement = $(document.createElement("li"));
				var $facetLinkElement = $(document.createElement("a"));
				$facetLinkElement.attr("href", facetGroupIndex + "::"
						+ taxonName + "::" + $(elem).attr("identifier") + "::"
						+ $(elem).attr("label"));
				$facetLinkElement.bind("click", handleDynamicFacetClic);
				$facetLinkElement.text($(elem).attr("label") + " ("
						+ $(elem).attr("count") + ") ");
				$facetElement.append($facetLinkElement);
				$facetsListContainer.append($facetElement);
				buildLinkHierarchy(facetGroupIndex, facetGroupName, taxonName, $facetElement, $(elem));
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
function addStaticFacetEntry(facetGroupIndex, facetGroupName, facetGroup) {
	$groupElement = $(document.createElement("details")).addClass("open").attr(
			"open", "open");
	$(document.createElement("summary")).text(facetGroupName).appendTo(
			$groupElement);
	var $facetContainerElement = $(document.createElement("ul"));
	$groupElement.append($facetContainerElement);
	$("#static-facets").append($groupElement);
	var facetGroupTranslated = mergeSynonimsAndTranslate(facetGroup);
	for ( var i = 0; i < facetGroupTranslated.length; i++) {
		var facet = facetGroupTranslated[i];
		var $facetElement = $(document.createElement("li"));
		var $facetLinkElement = $(document.createElement("a"));
		$facetLinkElement.bind("click", handleStaticFacetClic);
		$facetLinkElement.attr("href", facetGroupIndex + "::" + facet.label);
		$facetLinkElement.text(facet.label + " (" + facet.count + ") ");
		$facetElement.append($facetLinkElement);
		$facetContainerElement.append($facetElement);
	}
}
function mergeSynonimsAndTranslate(facetGroup) {
	var facetGroupTranslated = new Array();
	var counter=0;
	for ( var i = 0; i < facetGroup.length; i++) {
		if (TRANSLATE[facetGroup[i].label]) {
			var index = indexInFacetGroup(TRANSLATE[facetGroup[i].label],
					facetGroupTranslated);
			if (index != -1) {
				facetGroupTranslated[index].count += facetGroup[i].count;
			} else {
				facetGroupTranslated[counter] = new Object();
				facetGroupTranslated[counter].label =  TRANSLATE[facetGroup[i].label] ;
				facetGroupTranslated[counter].count = facetGroup[i].count;
				counter++;
			}
		} else {
			facetGroupTranslated[counter] = new Object();
			facetGroupTranslated[counter].label =  facetGroup[i].label ;
			facetGroupTranslated[counter].count = facetGroup[i].count;
			counter++;
		}
	}
	return facetGroupTranslated;
}
function indexInFacetGroup(label, facetGroup) {
	for ( var i = 0; i < facetGroup.length; i++) {
		if (facetGroup[i].label == label)
			return i;

	}
	return -1;
}
function handleStaticFacetClic(event) {
	event.preventDefault();
	var filter = $(event.target).attr("href");
	staticFilters.push(filter);
	staticFiltersTexts.push($(event.target).text());
	updateFilterList();
	handleKeyUpInRequestField(null);
}
function handleDynamicFacetClic(event) {
	event.preventDefault();
	var filter = $(event.target).attr("href");
	dynamicFilters.push(filter);
	dynamicFilterTexts.push($(event.target).text());
	updateFilterList();
	handleKeyUpInRequestField(null);
}
function populateSuggestionsList(xmlData) {
	$("#suggestions_wrapper").hide();
	$("#suggestions").empty();
	var suggestions = new Array();
	var suggestionsSource = new Array();
	var suggestion;
	var suggestionSource;
	$(xmlData).find("apiscol\\:query, query").each(function(index, elem) {
		suggestion = $(elem).text().replace(/~\d.?\d*/g, "");
		suggestionSource = $(elem).attr("source") == "data"
		if ($.inArray(suggestion, suggestions) == -1) {
			suggestions.push(suggestion);
			suggestionsSource.push()
		}
	});
	$(xmlData).find("apiscol\\:word, word").each(
			function(index, elem) {
				suggestion = $(elem).text();
				suggestionSource = $(elem).attr("source") == "data"
						|| $(elem).parent().attr("source") == "data";
				if ($.inArray(suggestion, suggestions) == -1) {
					suggestions.push(suggestion);
					suggestionsSource.push(suggestionSource);
				}

			});
	for ( var int = 0; int < suggestions.length; int++) {
		addItemToSuggestionsList(suggestions[int], suggestionsSource[int]);
		if (int == suggestions.length - 1)
			$("#suggestions").append(" ?")
		else
			$("#suggestions").append(", ");
	}

}
function addItemToSuggestionsList(wordOrQuery, dataSource) {
	$("#suggestions_wrapper").show();
	var $node = $(document.createElement("a"));
	$node.html(wordOrQuery);
	$node.attr("href", "");
	$node.addClass(dataSource ? "source-data" : "source-meta")
	$node.bind("click", handleSuggestionClick)
	$("#suggestions").append($node);

}
function handleSuggestionClick(event) {
	event.preventDefault();
	var text = $(event.target).text();
	$("input#query").val(text);
	submitQuery(text);
}

function triggerRequest() {
	handleKeyUpInRequestField(null);
}

function handleClearFacetsButtonClick(e) {
	staticFilters = new Array();
	dynamicFilters = new Array();
	staticFiltersTexts = new Array();
	dynamicFilterTexts = new Array();
	updateFilterList();
	triggerRequest();
}
function updateFilterList() {
	var liste = "";
	if (staticFiltersTexts.length > 0)
		liste += staticFiltersTexts.join(", ");
	if (dynamicFilterTexts.length > 0)
		liste += dynamicFilterTexts.join(", ");
	$("span.container-liste-filtres span").text(liste.replace(/\(\d+\)/g, ""))
}