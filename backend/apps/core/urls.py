from rest_framework.routers import DefaultRouter
from .views import (
    AcademicYearViewSet,
    ClassPeriodViewSet,
    ClassRoomViewSet,
    ClassViewSet,
    SectionViewSet,
    SubjectViewSet,
    VehicleViewSet,
    TransportRouteViewSet,
    AssignVehicleViewSet,
    BusStopViewSet,
    BusLocationViewSet,
    TransportAlertViewSet,
    BusRoutePickupUpdateViewSet,
    ItemCategoryViewSet,
    ItemStoreViewSet,
    SupplierViewSet,
    ItemViewSet,
    ItemReceiveViewSet,
    ItemIssueViewSet,
    ItemSellViewSet,
)

router = DefaultRouter()
router.register("academic-years", AcademicYearViewSet, basename="academic-year")
router.register("classes", ClassViewSet, basename="class")
router.register("sections", SectionViewSet, basename="section")
router.register("subjects", SubjectViewSet, basename="subject")
router.register("class-periods", ClassPeriodViewSet, basename="class-period")
router.register("class-rooms", ClassRoomViewSet, basename="class-room")

# Transport Module Routes
router.register("vehicles", VehicleViewSet, basename="vehicle")
router.register("transport-routes", TransportRouteViewSet, basename="transport-route")
router.register("assign-vehicles", AssignVehicleViewSet, basename="assign-vehicle")

# Bus Tracking Module Routes
router.register("bus-stops", BusStopViewSet, basename="bus-stop")
router.register("bus-locations", BusLocationViewSet, basename="bus-location")
router.register("transport-alerts", TransportAlertViewSet, basename="transport-alert")
router.register("bus-pickups", BusRoutePickupUpdateViewSet, basename="bus-pickup")

# Inventory Module Routes
router.register("item-categories", ItemCategoryViewSet, basename="item-category")
router.register("item-stores", ItemStoreViewSet, basename="item-store")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("items", ItemViewSet, basename="item")
router.register("item-receives", ItemReceiveViewSet, basename="item-receive")
router.register("item-issues", ItemIssueViewSet, basename="item-issue")
router.register("item-sells", ItemSellViewSet, basename="item-sell")

urlpatterns = router.urls
