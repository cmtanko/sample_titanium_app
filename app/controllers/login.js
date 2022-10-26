(function (args, $, exports) {
    args = args[0] || {};

    function CompetencyListController (args) {
        let self = this;
        self.cleanUp = cleanUp;
        self.listClick = listClick;
        self.applyFilter = applyFilter;
        self.closeWindow = closeWindow;
        self.manualRefresh = manualRefresh;
        self.applyTransform = applyTransform;
        
        const userId = args.userId || "1";
        const onClose = args.onClose || function () {};
        const userName = args.userName;
        
        const service = Alloy.Globals.Services.getService("competency");
        init();
        
        function init () {
            Alloy.Globals.currentPage = "COMPETENCY_LIST";
            
            Alloy.Globals.LogManager.debug("Competency List: Init Competency List");
            
            Alloy.Globals.toastMessage("Fetching data...", {
                persistent: false,
                theme: "success"
            });
            

            if (args.tabIndex) {
                $.tabFilter && $.tabFilter.setIndex(args.tabIndex);
            } else {
                $.tabFilter && $.tabFilter.setIndex(3);
            }

            $.tabFilter && $.tabFilter.setCallback(refreshCompetency);
            refreshCompetency();

            $.navbarWrapper && $.navbarWrapper.setTitle(userName.substring(0, 16));
        }

        function refreshCompetency () {
            startClickLoading();
            service.populate(userId).then(() => {
                stopLoading();
            }).catch((e) => {
                stopLoading();
                Alloy.Globals.toastMessage(e, {
                    persistent: false,
                    theme: "error"
                });
                setTimeout(() => {
                    cleanUp();
                }, 2000);
            });
            service.getCollection();
        }

        function manualRefresh (e) {
            e.hide && e.hide();
            startClickLoading("Loading...");
            setTimeout(() => {
                refreshCompetency();
                stopLoading();
            }, 1000);
        }

        function applyTransform (model) {
            var item = model.toJSON();
            item.detail =  "[" + item.id + "]";
            item.status = item.status.toUpperCase();
            let searchTerms = [];

            try {
                if (typeof item.search_terms === "string") {
                    searchTerms = JSON.parse(item.search_terms);
                } else if (
                    item.search_terms !== undefined &&
                    item.search_terms !== null &&
                    item.search_terms.length !== undefined
                ) {
                    searchTerms = item.search_terms;
                }
            } catch (e) {
                Alloy.Globals.LogManager.warn("Competency List: unable to get search terms for item: " +
                    item.uuid +
                    "search terms: " +
                    JSON.stringify(searchTerms));
                searchTerms = [];
            }

            
            // Ensure that the id and form name are in the search params
            searchTerms.push(item.id);
            searchTerms.push(item.name);
            searchTerms.push(item.status);
            item.search_terms = JSON.stringify(searchTerms);
            if (OS_IOS) {
                item.canEditItem = false;
            }
            return item;
        }

        function applyFilter (collection) {
            var index = $.tabFilter.getIndex();
            return collection.filter((item) => {
                if (index === 0) {
                    return item.get("status").toUpperCase() == "EXPIRED";
                } else if (index === 1) {
                    return item.get("status").toUpperCase() === "EXPIRING";
                } else if (index === 2) {
                    return item.get("status").toUpperCase() === "CURRENT";
                } else {
                    return true;
                }
            });
        }

        function listClick (e) {
        }


        function startClickLoading (message) {
            Alloy.Globals.loading.show(message || "Loading", true);
        }

        function stopLoading () {
            Alloy.Globals.loading.hide();
        }

        function cleanUp () {
            $.destroy();
            $.off();
            self = null;
            closeWindow();
        }

        function closeWindow () {
            Alloy.Globals.currentPage = Alloy.Globals.controllerName.HOME;
            $.userListWindow.close();
            onClose();
        }
    }

    _.extend(exports, new CompetencyListController(args));
})(arguments, $, exports);

function manualRefresh (e) {
    Alloy.Globals.LogManager.debug("Competency List: Manual refresh");
    exports.manualRefresh(e);
    Alloy.Globals.LogManager.debug("Competency List: Manual Refresh: done");
}
