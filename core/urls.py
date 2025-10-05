from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    path('items/', views.item_list, name='item_list'),
    path('items/new/', views.item_create, name='item_create'),
    path('items/<int:item_id>/', views.item_detail, name='item_detail'),
    path('items/<int:item_id>/bid/', views.place_bid, name='place_bid'),

    path('pay/<int:item_id>/', views.start_payment, name='start_payment'),
    path('pay/<int:item_id>/callback/', views.payment_callback, name='payment_callback'),

    path('chain/', views.chain_view, name='chain'),
]